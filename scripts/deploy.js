require("dotenv").config();
const { ethers } = require("hardhat");
const {
  getRole,
  verify,
  ex,
  printAddress,
  deploySC,
  deploySCNoUp,
} = require("../utils");

const { getRootFromMT } = require("../utils/merkleTree");

const { updateConfig } = require("./updateConfig");

var MINTER_ROLE = getRole("MINTER_ROLE");
var BURNER_ROLE = getRole("BURNER_ROLE");
var EXECUTER_ROLE = getRole("EXECUTER_ROLE");

var owner, signer2;

async function obtenerSigners(){
  [owner, signer2] = await ethers.getSigners();

  console.log("owner address: " + owner.address);
  console.log("signer2 address: " + signer2.address);
}

// Publicar NFT en Mumbai
async function deployMumbai() {
  await obtenerSigners();

  var relayerMumbaiAddress = "0xE79577482902E66ac9B01BC798D8F3E57C372502"; // address del relayer en mumbai quien tendra permiso de mint sobre el contrato NFT
  var name = "Cuy Collection NFT";
  var symbol = "CuyNFT";

  var nftContract = await deploySC("CuyCollectionNft", [name, symbol, owner.address, owner.address, owner.address, owner.address]);

  const implementationAddress = await printAddress("CuyCollectionNft", await nftContract.getAddress());

  await ex(nftContract, "grantRole", [MINTER_ROLE, relayerMumbaiAddress], "Falla en la asignacion del grant");

  await ex(nftContract, "setRoot", [getRootFromMT()], "Falla en la asignacion del root");

  verify(implementationAddress, "CuyCollectionNft", []);

  var config = {
    "addresses": {
      "nftAddress": await nftContract.getAddress()
    }
  };
  updateConfig(config);
}

// Publicar UDSC, Public Sale y Bbites Token en Goerli
async function deployGoerli() {
  await obtenerSigners();

  var relayerGoerliAddress = "0xe17170A262a2CB1a3Bb112A44AD4075C1bCfaCd5"; // address del relayer en goerli quien tendra permiso de mint sobre el contrato BBToken

  var usdcContract = await deploySCNoUp("USDCoin", []);

  var bbTokenContract = await deploySC("BBitesToken", [owner.address, owner.address, owner.address, owner.address]);

  var usdcAddress = await usdcContract.getAddress();
  var bbTokenAddress = await bbTokenContract.getAddress();
  
  var publicSaleContract = await deploySC("PublicSale", [usdcAddress, bbTokenAddress, owner.address, owner.address, owner.address]);

  var implementationAddressPublicSale = await printAddress("PublicSale", await publicSaleContract.getAddress());
  var implementationAddressBBToken = await printAddress("BBitesToken", bbTokenAddress);

  // set up
  //await ex(publicSaleContract, "grantRole", [EXECUTER_ROLE, relAddGoerli], "Falla en la asignacion del grant");
  await publicSaleContract.grantRole(EXECUTER_ROLE, relayerGoerliAddress);
  
  await ex(bbTokenContract, "grantRole", [MINTER_ROLE, relayerGoerliAddress], "Falla en la asignacion del grant");
  
  // script para verificacion del contrato
  verify(usdcAddress, "USDCoin", []);
  verify(implementationAddressBBToken, "BBitesToken", []);
  verify(implementationAddressPublicSale, "PublicSale", []);

  var liqProviderContract = await deploySCNoUp("LiquidityProvider", []);
  verify(await liqProviderContract.getAddress(), "LiquidityProvider", []);

  var swapperContract = await deploySCNoUp("Swapper", []);
  verify(await swapperContract.getAddress(), "Swapper", []);

  var config = {};
  var obj = config.addresses = {};

  obj.usdcAddress = usdcAddress;
  obj.bbTokenAddress = bbTokenAddress;
  obj.publicSaleAddress = await publicSaleContract.getAddress();
  obj.liqProviderAddress = await liqProviderContract.getAddress();
  obj.swapperAddress = await swapperContract.getAddress();
  updateConfig(config);
}

//obtenerSigners();

const networkName = hre.network.name;
console.log("networkName: " + networkName);
//const chainId = hre.network.config.chainId;

//falta para en un solo npx corre en ambos networks
try{

  if(networkName=="goerli"){
    //npx hardhat --network goerli run .\scripts\deploy.js
    deployGoerli();
  }
  else if(networkName=="mumbai"){
    //npx hardhat --network mumbai run .\scripts\deploy.js
    deployMumbai();
  }
  else{
    console.error("debe ingresar un network");
  }
}
catch(error){
  console.error(error);
  console.error(error.message);
  process.exitCode = 1;
}

/*
NOTA:

npx hardhat --network goerli run .\scripts\deploy.js

npx hardhat --network mumbai run .\scripts\deploy.js

Los deploys actualizan los addresses del los contratos en config.json:
{
  "addresses": {
    ...
  },
  "urls": {
    "WebhookURI_FirmaDigital": "https://api.defender..." 
  }
}

donde:
rpcUrl_Goerli => se usa para escuchar los eventos de goerli cuando en metamask el provider es mumbai
rpcUrl_Mumbai => se usa para escuchar los eventos de mumbai cuando en metamask el provider es goerli
WebhookURI_FirmaDigital => la URI del Webhook del AUTOTASK, que mediante el Relayer en Goerli, llamara al ERC20Permit.permit(...)

Cada vez que se deploya y genera los nuevos addresses, se tiene que actualizar:
- El address a monitorear por parte de los 2 Sentinels:
  https://defender.openzeppelin.com/#/sentinel
    [Sentinel en Goerli] => publicSaleAddress
    [Sentinel en Mumbai] => nftAddress
- El address en los scripts de los 3 Autotasks:
  https://defender.openzeppelin.com/#/autotask
    [Autotask de Goerli a Mumbai] => nftAddress
    [Autotask de Mumbai a Goerli] => bbTokenAddress
    [Autotask de FrontEnd a Goerli] => publicSaleAddress

En caso se reemplaze los Relayers, en cada red, el address del relayer se actualiza en las variables: relayerMumbaiAddress, relayerGoerliAddress

*/