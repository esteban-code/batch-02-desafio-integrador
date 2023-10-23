// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/*
Nota: https://wizard.openzeppelin.com/#erc721
    Usando el wizard de openzeppelin, para obtener la base del codigo del contrato, este esta usando pragma solidity ^0.8.20, diferente con el de 0.8.19, los cuales son:
    1) import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
       import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
       - afecta en la firma del contract
       - afecta en initialize
           __ERC721Pausable_init();
           __Pausable_init();
    2) function _update(address to, uint256 tokenId, address auth)
    3) function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize)
*/

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
//import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @custom:security-contact estaliaga@hotmail.com
contract CuyCollectionNft is Initializable, ERC721Upgradeable, ERC721PausableUpgradeable, AccessControlUpgradeable, ERC721BurnableUpgradeable, UUPSUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    bytes32 public root;

    event Burn(address account, uint256 id);

    //mapping (uint256 => address) public listaNFTAdquiridos;   //ya existe el mapping _owners accedido con la funcion ownerOf
    mapping (uint256 => bool) public lstBurnedNFT;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(string calldata tokenName, string calldata tokenSymbol, address defaultAdmin, address pauser, address minter, address upgrader)
        initializer public
    {
        __ERC721_init(tokenName, tokenSymbol);
        __ERC721Pausable_init();
        //__Pausable_init();
        __AccessControl_init();
        __ERC721Burnable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        //_grantRole(MINTER_ROLE, minter);//se comenta pues el unico que tendra permisos de minter es el Relayer en Mumbai
        _grantRole(UPGRADER_ROLE, upgrader);
    }

    function setRoot(bytes32 _root) public onlyRole(DEFAULT_ADMIN_ROLE){
        root = _root;
    }

    function _baseURI() internal pure override returns (string memory) {
        return "ipfs://QmTMnJBzGX9Lo9te4fu6JjvYZMSDHUpkQfvwCB8HAp8qmY/";
    }

    //solo llamado por el relayer de mumbai
    function safeMint(
        address to,
        uint256 tokenId
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        require(tokenId >= 0 && tokenId <= 999, "El tokenId no esta dentro del rango de NFTs para comprar");

        _safeMint(to, tokenId);//es suficiente con _mint cuando el comprador es una EOA, pero asumiremos que el comprador tambien puede ser un SCA
    }

    //puede ser llamado por cualquiera, se valida que forme parte de la lista blanca
    function safeMintWhiteList(
        address to,//se pudo omitir, y obtener el destino con el msg.sender, pero el msg.sender o el EOA llamante, debe estar en la lista blanca para que funcione
        uint256 tokenId,
        bytes32[] calldata proofs
    ) public whenNotPaused {
        require(tokenId >= 1000 && tokenId <= 1999, "El tokenId no esta dentro del rango de NFTs a repatirse en el Airdrop");

        bool verified = MerkleProof.verify(proofs, root, keccak256(abi.encodePacked(tokenId, to)));
        require(verified, "No eres parte de la lista del Airdrop");

        require(!_exists(tokenId), "El NFT ya fue creado y adquirido");
        require(!lstBurnedNFT[tokenId], "El NFT solicitado ha sido eliminado");

        _mint(to, tokenId);//el airdrop se da a solo billeteras, no necesitamos de usar _safeMint
    }

    //permite a los duenios de los ids en el rango de 1000 y 1999 (inclusivo) quemar sus NFTs a cambio de un repago de BBTKN en la red de Ethereum (Goerli)
    function buyBack(uint256 id) public {
        require(id >= 1000 && id <= 1999, "El id no esta dentro del rango de NFTs para realizar buyBack");
        address account =  _ownerOf(id);

        require(_exists(id) && account == msg.sender, "Su address no cuenta con el NFT ingresado");

        _burn(id);
        
        //hay que actualizar el root o  usar una lista negra, me voy por la lista negra
        lstBurnedNFT[id] = true;

        emit Burn(account, id);//dispara mint() en el token BBTKN en la cantidad de 10,000 BBTKNs
    }

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

    // The following functions are overrides required by Solidity.
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override(ERC721PausableUpgradeable, ERC721Upgradeable) {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }
}
