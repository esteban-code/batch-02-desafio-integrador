var { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
var { expect } = require("chai");
var { ethers, network } = require("hardhat");

var walletAndIds = require("../wallets/walletList");

describe("Testing para entender el error", function () {

    async function loadReset() {

        await ethers.provider.getBalance("0x007c5e822b66C5463a465ffC17BCf7E02aA9E1A4");
    }

    describe("hermano 1", () => {

        it("it hermano", async () => {
            //await loadFixture(loadReset);
            await ethers.provider.getBalance("0x007c5e822b66C5463a465ffC17BCf7E02aA9E1A4");
        });

    });

    describe("Account minting", () => {

        it("it 1", async () => {
            await loadFixture(loadReset);
            await ethers.provider.getBalance("0x007c5e822b66C5463a465ffC17BCf7E02aA9E1A4");
            console.log("EXEC it 1");
        });

        var walletSigners;
        before(async () => {
            console.log("BEFORE");
            //await loadFixture(loadReset);
            
            // 1 ether en hexadecimal
            var ONE_ETHER = `0x${ethers.parseEther("1").toString(16)}`;

            // Crea un array de billeteras con balance
            var getWalletsPromises = walletAndIds
                .slice(0, 1)
                .map(async ({ address, privateKey }) => {
                    var wallet = new ethers.Wallet(privateKey, ethers.provider);
                    await network.provider.send("hardhat_setBalance", [
                        address,
                        ONE_ETHER,
                    ]);
                    return wallet;
                });

            // Esperar a que terminen los requests
            walletSigners = await Promise.all(getWalletsPromises);

            //resetea el ambiente a como cuando se llamo por primera vez a loadFixture(loadReset)
            //es como que la primera llamada a loadFixture(loadReset) se tome una foto del momento, y en subsiguiente(s) llamda(s) a loadFixture(loadReset), se restablece o resetea el ambiente a dicha foto 
            //si la primera llamada a loadFixture(loadReset) se hizo antes del envio de ether a la billetera, cuando se vuelva a llamar a loadFixture(loadReset) se 'eliminara' ese envio de ether a la billetera
            //Si se tienen varios 'it' que llaman a loadFixture(loadReset), y si el before() esta luego del 'it 1', el before() igual se ejecuta antes de cualquier 'it'
            //1) Llamar por primera vez a loadFixture(loadReset) luego de hacer el envio de ether a la billetera, para que este envio de ether forme parte de la foto, en caso se llame posteriormente a loadFixture(loadReset)
            //2) Sin embargo, no podemos asegurar que despues, no hagamos una llamada a loadFixture(loadReset) que pueda convertirse en la 1ra llamada en el testing, sin darnos cuenta que afectaria la solucion 1)
            //   Para evitar ese escenario, usar before()/beforeEach(), y dentro de este llamar a loadFixture(loadReset), y ya no llamarlo en los 'it', 
            //   y se recomienda mejor llamarlo al inicio del before() o antes de la logica de envio de ether a la billetera, en caso loadFixture(loadReset) ya haya sido llamado por 1ra vez mucho antes.
            await loadFixture(loadReset);

            console.log("address Previo: " + walletSigners[0].address);
            console.log("balance de ethers Previo: " + await ethers.provider.getBalance(walletSigners[0].address));
        });

        it("it 2", async () => {
            console.log("EXEC it 2");
            await loadFixture(loadReset);

            console.log("address After: " + walletSigners[0].address);
            console.log("balance de ethers After: " + await ethers.provider.getBalance(walletSigners[0].address));

            expect(await ethers.provider.getBalance(walletSigners[0].address)).to.not.be.equal(BigInt(0));
        });

    });

});