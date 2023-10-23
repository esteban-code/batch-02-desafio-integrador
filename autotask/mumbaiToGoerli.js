/*
We are migrating our packages to @openzeppelin namespace, we recommend you to migrate your Autotask code imports if you haven't.
Example: if your Autotask code imports defender-relay-client now it should import @openzeppelin/defender-relay-client instead.
*/

const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
//} = require("@openzeppelin/defender-relay-client/lib/ethers");
} = require("defender-relay-client/lib/ethers");

exports.handler = async function (data) {
  // Eventos que vienen del sentinel
  // Este evento viene de Mumbai cuando el duenio llama al contrato NFT para quemar su NFT, 
  // el cual emite un evento, para ser enviado al contrato BBToken y este le acunia un monto de tokens
  const payload = data.request.body.events;

  // Inicializa Proveedor: en este caso es OZP
  const provider = new DefenderRelayProvider(data);

  // Se crea el signer quien será el msg.sender en los smart contracts
  const signer = new DefenderRelaySigner(data, provider, { speed: "fast" });

  // Filtrando solo eventos
  var onlyEvents = payload[0].matchReasons.filter((e) => e.type === "event");
  if (onlyEvents.length === 0) return;

  // Filtrando solo Burn
  var event = onlyEvents.filter((ev) =>
    ev.signature.includes("Burn")
  );
  // Mismos params que en el evento
  var { account, id } = event[0].params;

  // Ejecutar en el contrato BBToken la funcion 'mint' en Goerli
  var bbTokenAddress = "0x6562bAEEd7CaDB304B5EEdeE6CD5713C44c9334E";
  var bbTokenAbi = ["function mint(address to, uint256 amount)"];
  var bbTokenContract = new ethers.Contract(bbTokenAddress, bbTokenAbi, signer);
  
// *************** VERSION PARA OPENZEPELLIN - DEFENDER V1 - AUTOTASK - ETHERS VERSION 5.5.3 ***************
// https://docs.openzeppelin.com/defender/v1/autotasks#environment
// var amount = ethers.utils.parseEther("10000");
// *********************************************************************************************************

  //var amount = ethers.parseEther("10000");
  var amount = ethers.utils.parseEther("10000");

  var tx = await bbTokenContract.mint(account, amount);
  var res = await tx.wait();
  return res;
};
