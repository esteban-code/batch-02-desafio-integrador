// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/*
Nota: https://wizard.openzeppelin.com/#erc20
    Usando el wizard de openzeppelin, para obtener la base del codigo del contrato, este esta usando pragma solidity ^0.8.20, diferente con el de 0.8.19, los cuales son:
    1) import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol"; 
       import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
       - afecta en la firma del contract
       - afecta en initialize
           __ERC20Pausable_init();
           __Pausable_init();
    2) function _update(address from, address to, uint256 value)
    3) function _beforeTokenTransfer(address from, address to, uint256 amount)

*/

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
//import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";


/// @custom:security-contact estaliaga@hotmail.com
contract BBitesToken is Initializable, ERC20Upgradeable, ERC20PausableUpgradeable, AccessControlUpgradeable, ERC20PermitUpgradeable, UUPSUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address defaultAdmin, address pauser, address minter, address upgrader)
        initializer public
    {
        __ERC20_init("BBites Token", "BBTKN");
        __ERC20Pausable_init();
        //__Pausable_init();
        __AccessControl_init();
        __ERC20Permit_init("BBites Token");
        __UUPSUpgradeable_init();

        _mint(msg.sender, 1_000_000 * 10 ** decimals());    //Ese millon sera utilizado para crear el pool de liquidez junto al USDC

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        //el unico que tendra permiso de minter es el Relayer en Goerli, 
        //descartamos que el dueño del contrato tambien pueda para mintearse a si mismo, o mintear a otros por ejemplo al liqProvider
        //_grantRole(MINTER_ROLE, minter);
        _grantRole(UPGRADER_ROLE, upgrader);
    }

    //Unicamente lo llama el Relayer en Goerli
    //Este metodo es disparado cuando desde Polygon (Mumbai) se quema un NFT cuyo id está entre 1000 y 1999 (inclusivo). Se acunia 10,000 tokens al address que quemo su NFT.
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) whenNotPaused {
        //validacion innecesaria pues este monto se define en el autotask
        //require(amount == 10_000 * 10**18, "No es la cantidad de BBTokens esperado a ser acuniado al que quemo su NFT");

        _mint(to, amount);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20PausableUpgradeable, ERC20Upgradeable) whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}

}
