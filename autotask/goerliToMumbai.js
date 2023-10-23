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
  // Este evento viene de Goerli cuando el comprador paga atraves de PublicSale, 
  // el cual emite un evento, para ser enviado al contrato NFT y este le acunia el NFT
  const payload = data.request.body.events;

  // Inicializa Proveedor: en este caso es OZP
  const provider = new DefenderRelayProvider(data);

  // Se crea el signer quien será el msg.sender en los smart contracts
  const signer = new DefenderRelaySigner(data, provider, { speed: "fast" });

  // Filtrando solo eventos
  var onlyEvents = payload[0].matchReasons.filter((e) => e.type === "event");
  if (onlyEvents.length === 0) return;

  // Filtrando solo PurchaseNftWithId
  var event = onlyEvents.filter((ev) =>
    ev.signature.includes("PurchaseNftWithId")
  );
  // Mismos params que en el evento
  var { account, id } = event[0].params;

  // Ejecutar en el contrato NFT la funcion 'safeMint' en Mumbai
  var nftAddress = "0x9B1724C4fE930c076A1d33F925edeBC5020ef1Ad";
  var nftAbi = ["function safeMint(address to, uint256 tokenId)"];
  var nftContract = new ethers.Contract(nftAddress, nftAbi, signer);
  var tx = await nftContract.safeMint(account, id);
  var res = await tx.wait();
  return res;
};
