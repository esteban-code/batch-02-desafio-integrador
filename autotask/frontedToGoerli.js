const { ethers } = require("ethers");
const {
    DefenderRelaySigner,
    DefenderRelayProvider,
    //} = require("@openzeppelin/defender-relay-client/lib/ethers");
} = require("defender-relay-client/lib/ethers");

exports.handler = async function (data) {
    const payload = data.request.body;

    console.log("inicio autotask");
    console.log(payload);
    console.log("fin autotask");

    const provider = new DefenderRelayProvider(data);
    // Se crea el signer quien será el msg.sender en los smart contracts
    const signer = new DefenderRelaySigner(data, provider, { speed: "fast" });

    var publicSaleAddress = "0x4B066f9F7ebDE0B7f6501A318Be07eedF06dbAb5";
    var publicSaleAbi = ["function executePermitAndPurchase(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public"];
    var publicSaleContract = new ethers.Contract(publicSaleAddress, publicSaleAbi, signer);//se le pasa el signer (q internamente esta atado al provider), no el provider
    var tx = await publicSaleContract.executePermitAndPurchase(
        payload.ownerAddress,
        payload.spenderAddress,
        payload.value,
        payload.deadline,
        payload.v,
        payload.r,
        payload.s
    );
    var res = await tx.wait();
    return res;
};
