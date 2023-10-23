// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/*
Nota: https://wizard.openzeppelin.com/#custom
    Usando el wizard de openzeppelin, para obtener la base del codigo del contrato, este esta usando pragma solidity ^0.8.20, diferente con el de 0.8.19, los cuales son:
    Error HH404: File @openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol, imported from contracts/PublicSale.sol, not found.
*/

//import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "@openzeppelin/contracts/utils/Strings.sol";

//import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol"; //para obtener decimals() de USDCoin
// import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol"; //para obtener decimals() de BBToken
// import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20PermitUpgradeable.sol";
//import {IUniswapV2Router02} from "./Interfaces.sol";
import "./Interfaces.sol";

//Sirve como intermediario para poder realizar el pago para adquirir NFTs.
/// @custom:security-contact estaliaga@hotmail.com
contract PublicSale is Initializable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant EXECUTER_ROLE = keccak256("EXECUTER_ROLE");

    // 00 horas del 30 de septiembre del 2023 GMT
    uint256 constant startDate = 1696032000;

    // Maximo price NFT
    uint256 constant MAX_PRICE_NFT = 90_000;

    //evento que sera escuchado por Open Zeppelin Defender, que a su vez ordenara al contrato de NFT en Polygon (Mumbai) de acuniar un determinado NFT
    event PurchaseNftWithId(address account, uint256 id);
    event SwapAmounts(uint[] amounts);

    IERC20Metadata usdCoin;
    IERC20MetadaPermitUpgradeable bbToken;
    IUniswapV2Router02 router;
    
    mapping (uint256 => address) public listaNFTComprados;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _usdCoinAddress, address _bbTokenAddress, address defaultAdmin, address pauser, address upgrader)
        initializer public
    {
        usdCoin = IERC20Metadata(_usdCoinAddress);
        bbToken = IERC20MetadaPermitUpgradeable(_bbTokenAddress);
        router = IUniswapV2Router02(routerAddress);

        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(UPGRADER_ROLE, upgrader);
    }

    modifier postPurchase(uint256 _id){
        //require(listaNFTComprados[_id]== address(0), "El NFT ya fue comprado");
        _;
        emit PurchaseNftWithId(msg.sender, _id);
        listaNFTComprados[_id] = msg.sender;
    }

    function purchaseWithTokens(uint256 _id) public postPurchase(_id) {
        require(_id >= 0 && _id <= 699, "El id no esta dentro del rango de NFTs para comprarlo con BBTKN tokens");
        require(listaNFTComprados[_id]== address(0), "El NFT ya fue comprado");
        
        //Previamente el comprador (EOA) debe haber dado permiso al contrato (SCA) PublicSale sobre una cantidad de BBTokens, 
        //para que luego, mediante transferFrom, el contrato PublicSale se transfiera a si mismo los BBTokens (gastador = destinatario)

        //Aunque no es necesario validar que se le haya dado dicho permiso (pues esto es redundante ya lo hace internamente el transferFrom),
        //lo haremos para mostrar un mensaje personalizado en caso no se tenga el permiso suficiente
        uint256 amountBBTokens = getPriceForId(_id);
        require(bbToken.allowance(msg.sender, address(this)) >= amountBBTokens, "Permiso insuficiente sobre los BBTokens");

        bbToken.transferFrom(msg.sender, address(this), amountBBTokens);
    }

    function estimateUSDCoinsForExactBBTokens(uint256 _id) public view returns(uint256){
        require(_id >= 0 && _id <= 699, "El id no esta dentro del rango de NFTs para adquirirlos con USDC");
        uint256 amountOut = getPriceForId(_id);
        address[] memory path = new address[](2);
        path[0] = address(usdCoin);
        path[1] = address(bbToken);
        uint[] memory amounts = router.getAmountsIn(amountOut, path);
    
        //no se requiere emitir un evento para retornar el valor a la web 2.0
        //si se emite el evento:
        //- la funcion ya no es view y no retorna el valor a la web 2.0 de forma directa
        //- se requeriria de firmar la tx pues la tx consumiria gas
        //emit estimateUsdc(amounts[0]); // event estimateUsdc(uint256 amount);

        return amounts[0];
    }

    function purchaseWithUSDC(uint256 _id, uint256 _amountIn) public postPurchase(_id) {
        // transfiere _amountIn de USDC a este contrato
        // llama a swapTokensForExactTokens: valor de retorno de este metodo es cuanto gastaste del token input
        // transfiere el excedente de USDC a msg.sender

        require(_id >= 0 && _id <= 699, "El id no esta dentro del rango de NFTs para comprarlo con USDCoins");
        require(listaNFTComprados[_id]== address(0), "El NFT ya fue comprado");
		
		//Previamente el comprador (EOA) debe darle approve al contrato (SCA) PublicSale sobre sus USDCoins,
        //para que luego, mediante transferFrom, el contrato PublicSale se transfiera a si mismo los USDCoins (gastador = destinatario)

        //Aunque no es necesario validar que se le haya dado dicho permiso (pues esto es redundante ya lo hace internamente el transferFrom),
        //lo haremos para mostrar un mensaje personalizado en caso no se tenga el permiso suficiente
        require(usdCoin.allowance(msg.sender, address(this)) >= _amountIn, "Permiso insuficiente sobre los USDCoins");

		usdCoin.transferFrom(msg.sender, address(this), _amountIn);
		
		//El contrato PublicSale ya es duenio de todo el _amountIn USDCoins
		
		//Previamente: ya existe el pool de liquidez, se hizo una sola vez el LiquidityProvider.addLiquidity(...) (Ejem: 2000 BBToken <=> 100 USDCoin)
		
		//El contrato PublicSale le debe dar approve al Router sobre sus USDCoins
        usdCoin.approve(address(router), _amountIn);

        //El Router internamente hace un transferFrom para transferir al pool la cantidad "necesaria" de USDCoins, a cambio de la cantidad fija BBTokens
        uint amountOut = getPriceForId(_id);
        address[] memory path = new address[](2);
        path[0] = address(usdCoin);
        path[1] = address(bbToken);
        address to = address(this);
        uint deadline = block.timestamp + 60;

        uint256[] memory amounts = router.swapTokensForExactTokens(//cuando se invoca a una funcion _swapTokensForExactTokens(...) ahi sale error de conversion address[] memory incompatible con address[] calldata
                                        amountOut,
                                        _amountIn,//amountInMax: el maximo de USDCoins a ser tredeado
                                        path,//[tokenB, tokenA] = voy a entregar tokens B para obtener tokens A
                                        to,
                                        deadline
                                    );
        emit SwapAmounts(amounts);

		//PublicSale tiene que devolver los usdcoins sobrantes (en caso haya vuelto)
        uint256 diff = _amountIn - amounts[0];
        if(diff > 0){
            usdCoin.transfer(msg.sender, diff);
        }

    }

    function purchaseWithEtherAndId(uint256 _id) public payable postPurchase(_id) {
        require(_id >= 700 && _id <= 999, "El id no esta dentro del rango de NFTs para comprarlo con Ether");
        require(listaNFTComprados[_id]== address(0), "El NFT ya fue comprado");

        uint256 price = 0.1 * 10**18;
        require(msg.value >= price, "No se ha enviado suficiente ether para comprar el NFT");

        uint256 diff = msg.value - price;
        if(diff > 0){
            payable(msg.sender).transfer(diff);
        }

    }
    
    function depositEthForARandomNft() public payable {
        uint256 num = uint256(keccak256(abi.encodePacked(msg.sender, blockhash(block.number - 1), block.timestamp)));
        uint min = 700;
        uint max = 999;
        uint256 _id = num % (max - min + 1) + min;

        //require(_id >= 700 && _id <= 999, "El id no esta dentro del rango de NFTs para comprarlo con Ether");
        require(listaNFTComprados[_id]== address(0), "El NFT ya fue comprado");

        uint256 price = 0.1 * 10**18;
        require(msg.value >= price, "No se ha enviado suficiente ether para comprar el NFT");

        uint256 diff = msg.value - price;
        if(diff > 0){
            payable(msg.sender).transfer(diff);
        }

        emit PurchaseNftWithId(msg.sender, _id);

        listaNFTComprados[_id] = msg.sender;
    }

    //Un SCA envia ether (a este SCA) usando payable(psAdd).transfer(_amount) [transfer/send/call]
    //desde javascript (entorno hardhat/npm o browser), no se puede llamar contrato.transfer [transfer/send/call/recieve/fallback]
    //pero si usando: wait wallet.sendTransaction({to: recipient, value: amount});, el cual dispara el receive del contrato
    receive() external payable {
        depositEthForARandomNft();
    }

    /*
    function getEtherBalance() public view onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256) {
        return address(this).balance;
    }
    */

    //cualquier admin transferirse el ether que fue depositado a este contrato
    function withdrawEther() public onlyRole(DEFAULT_ADMIN_ROLE){
        payable(msg.sender).transfer(address(this).balance);
    }

    //cualquier admin transferirse los tokens BBTKN que fueron depositados a este contrato
    function withdrawTokens() public onlyRole(DEFAULT_ADMIN_ROLE){
        bbToken.transfer(msg.sender, bbToken.balanceOf(address(this)));
    }

    function executePermitAndPurchase(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public onlyRole(EXECUTER_ROLE){

        //validacion innecesaria
        require(spender==address(this), "Spender y PublicSale son diferentes");

        bbToken.permit(
            owner,
            spender,
            value,
            deadline,
            v,
            r,
            s
        );

        uint256 num = uint256(keccak256(abi.encodePacked(msg.sender, blockhash(block.number - 1), block.timestamp)));
        uint min = 0;
        uint max = 699;
        uint256 nftId = num % (max - min + 1) + min;

        //require(nftId >= 0 && nftId <= 699, "El id no esta dentro del rango de NFTs para comprarlo con Ether");
        require(listaNFTComprados[nftId]== address(0), "El NFT ya fue comprado");

        //**** el enunciado dice obtener un NFT aleatoriamente en el rango de 700 a 999, pero en este se paga con ethers no bbtokens ****/
        //uint256 price = 0.1 * 10**18;
        uint256 amount = getPriceForId(nftId);

        //bbToken.permit() deberia ir despues de la validacion de si el monto es suficiente.
        //require(value >= amount, "El monto permitido al spender no es suficiente");
        require(value >= amount, 
            string(
                abi.encodePacked(
                    "Monto permitido ", StringsUpgradeable.toString(value), " es menor al Monto solicitado ", StringsUpgradeable.toString(amount),
                    ", para el NFTId ", StringsUpgradeable.toString(nftId)
                )
            )
        );

        //validacion innecesaria
        require(bbToken.allowance(owner, address(this)) >= amount, "Monto permitido insuficiente");
        
        bbToken.transferFrom(owner, address(this), amount);

        emit PurchaseNftWithId(owner, nftId);

        listaNFTComprados[nftId] = owner;
    }

    /*
    La siguiente tabla resume la informacion de ids vs tips vs precios.

    id (inclusivo)	Tipo			Precio (BBTKN)
    0 - 199			Comun			1000 BBTKN fijo
    200 - 499		Raro			Multiplicar su id por 20
    500 - 699		Legendario		Segun dias pasados*****
    700 - 999		Mistico			0.01 ether fijo
    1000 - 1999		Whitelist		Sin precio
    *****Nota: Su precio cambia segun el # de dias pasados desde las 00 horas del 30 de septiembre del 2023 GMT (obtener el timestamp en epoch converter). 
    El primer dia empieza en 10,000 BBTKN. Por cada dia pasado, el precio se incrementa en 2,000 BBTKN. El precio maximo es 90,000 BBTKN.
    */

    //solo indica el precio (cantidad de bbtokens) para la modalidad de compra con bbtokens o usdcoins
    //lo hago public para efectos de usarlo en los tests
    function getPriceForId(uint256 _id) public view returns(uint256){
        uint256 price;
        require(_id >= 0 && _id <= 699, "El id no esta dentro del rango de NFTs a ser comprados a cambio de BBTokens");

        //# de bbTokens
        if(_id >= 0 && _id <= 199){
            price = 1000;
        }
        if(_id >= 200 && _id <= 499){
            price = _id * 20;
        }
        if(_id >= 500 && _id <= 699){
            uint256 diff = (block.timestamp - startDate) / 60 / 60 / 24;
            require(diff>=0, "Aun no inicia la venta de NFTs");
            price = 10000 + (2000 * diff);
            if(price >= MAX_PRICE_NFT){ 
                price = MAX_PRICE_NFT; 
            }
        }
        return price * 10 ** bbToken.decimals();
    }

    event priceForAnyNftId(string msgPrice);
    
    function getPriceForAnyNftId(uint256 _id) public returns(string memory){
        require(_id >= 0 && _id <= 1999, "El id no esta dentro del rango de NFTs a ser adquiridos");
        uint256 amount;
        string memory precio;
        if(_id >= 0 && _id <= 699){
            amount = getPriceForId(_id);
            precio = string.concat(Strings.toString(amount), " bbtokens");
        }
        else if(_id >= 700 && _id <= 999){
            amount = 0.1 * 10 **18;
            precio = string.concat(Strings.toString(amount), " ethers"); // "0.1 ether";
        }
        else{
            precio = "sin costo";
        }

        //no se requiere emitir un evento para retornar el valor a la web 2.0
        //si se emite el evento:
        //- la funcion ya no es view y no retorna el valor a la web 2.0 de forma directa
        //- se requeriria de firmar la tx pues la tx consumiria gas
        emit priceForAnyNftId(precio); // event priceForAnyNftId(string msgPrice);

        return string.concat("El costo es: ", precio);
    }

    ////////////////////////////////////////////////////////////////////////
    /////////                    Helper Methods                    /////////
    ////////////////////////////////////////////////////////////////////////

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}
}
