var { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
var { expect } = require("chai");
var { ethers, network } = require("hardhat");
const { getRole, deploySC, deploySCNoUp } = require("../utils");

const { getRootFromMT, getProofs, walletAndIds } = require("../utils/merkleTree");

const MINTER_ROLE = getRole("MINTER_ROLE");
const BURNER_ROLE = getRole("BURNER_ROLE");
const PAUSER_ROLE = getRole("PAUSER_ROLE");
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

// como hay contratos que involucran llamadas al Router de Uniswap, y ademas de crear el poolContract, se tiene que correr un fork de un nodo de goerli, con el comando:
// npx hardhat node --fork https://goerli.infura.io/v3/d9a8ce72510f4302afce5a62bd6627a2
// luego, en otra terminal, se ejecuta el test con el comando: npx hardhat --network localhost test .\test\test_crosschain.js

describe("Testing Desafio Integral", function () {

    async function loadContracts() {

        var [owner, alice, relayerMumbai, relayerGoerli] = await ethers.getSigners();

        var usdcContract = await deploySCNoUp("USDCoin", []);
        var bbTokenContract = await deploySC("BBitesToken", [owner.address, owner.address, owner.address, owner.address]);

        await bbTokenContract.grantRole(MINTER_ROLE, relayerGoerli.address);

        var usdcAddress = await usdcContract.getAddress();
        var bbTokenAddress = await bbTokenContract.getAddress();

        var publicSaleContract = await deploySC("PublicSale", [usdcAddress, bbTokenAddress, owner.address, owner.address, owner.address]);

        var name = "Cuy Collection NFT";
        var symbol = "CuyNFT";
        var nftContract = await deploySC("CuyCollectionNft", [name, symbol, owner.address, owner.address, owner.address, owner.address]);

        await nftContract.grantRole(MINTER_ROLE, relayerMumbai.address);
        await nftContract.setRoot(getRootFromMT());

        return { usdcContract, bbTokenContract, publicSaleContract, nftContract, owner, alice, relayerMumbai, relayerGoerli };
    }

    //para efectos de simplicidad, y poder comprar con bbtokens o usdcoins, se suministrara solo el 50% del balance de cada token por parte del creador de ambos tokens
    async function creacionPoolLiquidez() {
        var { usdcContract, bbTokenContract, publicSaleContract, nftContract, owner, alice, relayerMumbai, relayerGoerli } = await loadContracts();

        var liqProviderContract = await deploySCNoUp("LiquidityProvider", []);

        liqProviderContract.on("LiquidityAmounts", async (amountA, amountB, liquidity) => {
            console.log("event amounts: [ " + amountA + ", " + amountB + " ]");
        });

        var amountUsdc = await usdcContract.balanceOf(owner.address) / 2n;
        var amountBBToken = await bbTokenContract.balanceOf(owner.address) / 2n;

        console.log("usdcContract.getAddress(): " + await usdcContract.getAddress());
        console.log("bbTokenContract.getAddress(): " + await bbTokenContract.getAddress());

        console.log("amounts: [ " + amountUsdc + ", " + amountBBToken + " ]");

        await usdcContract.approve(await liqProviderContract.getAddress(), amountUsdc);
        await bbTokenContract.approve(await liqProviderContract.getAddress(), amountBBToken);

        var tx = await liqProviderContract.
            addLiquidity(
                await usdcContract.getAddress(),
                await bbTokenContract.getAddress(),
                amountUsdc,
                amountBBToken,
                amountUsdc,
                amountBBToken,
                owner.address,
                (new Date().getTime() + 60000)
            );

        var usdcAddress = await usdcContract.getAddress();
        var bbTokenAddress = await bbTokenContract.getAddress();

        var poolAddress = await liqProviderContract.getPair(usdcAddress, bbTokenAddress);
        // console.log("poolAddress: " + poolAddress);

        const abi = [
            "function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast)"
        ];
        const poolContract = new ethers.Contract(poolAddress, abi, ethers.provider);

        var [_reserve0, _reserve1, _blockTimestampLast] = await poolContract.getReserves();
        //https://ethereum.stackexchange.com/questions/114625/i-cant-calculate-liquidity-of-a-pair-using-getreserves-function
        //Tokens are ordered by the token contract address The token contract address can be interpreted as a number, and the smallest one will be token0 internally
        console.log(await poolContract.getReserves());
        // console.log("reserves: [ " + _reserve0 + ", " + _reserve1 + " ]");

        console.log("pool balances: [ " + await usdcContract.balanceOf(poolAddress) + ", " + await bbTokenContract.balanceOf(poolAddress) + " ]");
        console.log("owner balances: [ " + await usdcContract.balanceOf(owner.address) + ", " + await bbTokenContract.balanceOf(owner.address) + " ]");

        return { usdcContract, bbTokenContract, publicSaleContract, nftContract, owner, alice, relayerMumbai, relayerGoerli };
    }

    describe("PublicSale.purchase (compra con Usdc/BBToken/Ether) desde Goerli y CuyCollectionNft.safeMint (mint NFT) en Mumbai", () => {
        var usdcContract, bbTokenContract, publicSaleContract, nftContract, owner, alice, relayerMumbai;
        var account, publicSaleAddress;

        beforeEach(async function () {
            var fixtures = await loadFixture(creacionPoolLiquidez);
            usdcContract = fixtures.usdcContract;
            bbTokenContract = fixtures.bbTokenContract;
            publicSaleContract = fixtures.publicSaleContract;
            nftContract = fixtures.nftContract;
            owner = fixtures.owner;
            alice = fixtures.alice;
            relayerMumbai = fixtures.relayerMumbai;
            account = fixtures.owner.address;
            publicSaleAddress = await fixtures.publicSaleContract.getAddress();
        });

        it("compra con BBToken y acuniasion de NFT solicitado", async () => {
            // PUBLIC SALE
            var nftId = 0;

            var amount = await publicSaleContract.connect(owner).getPriceForId(nftId); //ethers.parseEther("1000");
            await bbTokenContract.connect(owner).approve(publicSaleAddress, amount);

            var tx = await publicSaleContract.connect(owner).purchaseWithTokens(nftId);
            // aqui validar que el evento se haya disparado
            await expect(tx).to.emit(publicSaleContract, "PurchaseNftWithId").withArgs(owner.address, nftId);

            // Aquí en el medio está Open Zeppelin Defender
            // Para propósitos de testing nos saltamos este paso

            // NFT
            await nftContract.connect(relayerMumbai).safeMint(owner.address, nftId);
            // aqui validar que se haya entregado el nft con el id y address correctos
            expect(await nftContract.ownerOf(nftId)).to.be.equals(owner.address);
        });

        it("compra con BBToken sin embargo no se acunia el NFT porque esta pausado", async () => {
            // NFT
            await nftContract.pause();

            // PUBLIC SALE
            var nftId = 0;

            var amount = await publicSaleContract.connect(owner).getPriceForId(nftId);
            await bbTokenContract.connect(owner).approve(publicSaleAddress, amount);

            var tx = await publicSaleContract.connect(owner).purchaseWithTokens(nftId);
            await expect(tx).to.emit(publicSaleContract, "PurchaseNftWithId").withArgs(owner.address, nftId);

            // Aquí en el medio está Open Zeppelin Defender
            // Para propósitos de testing nos saltamos este paso

            // NFT
            await expect(nftContract.connect(relayerMumbai).safeMint(owner.address, nftId)).to.be.revertedWith("Pausable: paused");
        });

        it("compra con USDCoin y acuniasion de NFT solicitado", async () => {
            // PUBLIC SALE
            var nftId = 0;
            var amount = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);
			//console.log("uscd amount estimated: " + amount);
			
            await usdcContract.connect(owner).approve(publicSaleAddress, amount);
            var tx = await publicSaleContract.connect(owner).purchaseWithUSDC(nftId, amount);
            // aqui validar que el evento se haya disparado
            await expect(tx).to.emit(publicSaleContract, "PurchaseNftWithId").withArgs(owner.address, nftId);

            // Aquí en el medio está Open Zeppelin Defender
            // Para propósitos de testing nos saltamos este paso

            // NFT
            await nftContract.connect(relayerMumbai).safeMint(owner.address, nftId);
            // aqui validar que se haya entregado el nft con el id y address correctos
            expect(await nftContract.ownerOf(nftId)).to.be.equals(owner.address);
        });

        it("compra con Ether y acuniasion de NFT solicitado", async () => {
            // PUBLIC SALE
            var amount = ethers.parseEther("0.1");
            var nftId = 700;
            var tx = await publicSaleContract.connect(owner).purchaseWithEtherAndId(nftId, { value: amount });
            // aqui validar que el evento se haya disparado
            await expect(tx).to.emit(publicSaleContract, "PurchaseNftWithId").withArgs(owner.address, nftId);

            // Aquí en el medio está Open Zeppelin Defender
            // Para propósitos de testing nos saltamos este paso

            // NFT
            await nftContract.connect(relayerMumbai).safeMint(owner.address, nftId);
            // aqui validar que se haya entregado el nft con el id y address correctos
            expect(await nftContract.ownerOf(nftId)).to.be.equals(owner.address);
        });

        it("compra con Ether y acuniasion de NFT random", async () => {
            //no se puede saber el NFT random
            //se puede con el metodo .on(), su uso es correcto en frontend, pero es inestable en los test, pues ejecuta un thread en paralelo que produce anomalias en test posteriores
        });

    });

    describe("CuyCollectionNft.buyBack (burn NFT) en Mumbai y BBitesToken.mint (mint BBTokens) en Goerli", () => {
        var bbTokenContract, nftContract, owner, relayerGoerli;
        var account;
        var walletSigners;

        beforeEach(async function () {
            var fixtures = await loadFixture(loadContracts);
            bbTokenContract = fixtures.bbTokenContract;
            nftContract = fixtures.nftContract;
            owner = fixtures.owner;
            relayerGoerli = fixtures.relayerGoerli;
            account = fixtures.owner.address;

            // 1 ether en hexadecimal
            var ONE_ETHER = `0x${ethers.parseEther("1").toString(16)}`;

            // Crea un array de billeteras con balance
            var getWalletsPromises = walletAndIds
                .slice(0, 1)
                .map(async ({ address, privateKey, id }) => {
                    var _wallet = new ethers.Wallet(privateKey, ethers.provider);
                    await network.provider.send("hardhat_setBalance", [
                        address,
                        ONE_ETHER,
                    ]);
                    return { 'nftId': id, 'wallet': _wallet };
                });

            // Esperar a que terminen los requests
            walletSigners = await Promise.all(getWalletsPromises);
        });

        it("adquiere su NFT de whiteList, luego lo quema para que se le acunie 10000 BBTokens", async () => {
            // NFT
            //Primero se adquiere su NFT de la lista blanca
            for (var w of walletSigners) {
                var nftId = w.nftId;
                var wallet = w.wallet;
                var proofs = getProofs(nftId, wallet.address);

                await nftContract.connect(wallet).safeMintWhiteList(wallet.address, nftId, proofs);
                expect(await nftContract.ownerOf(nftId)).to.be.equal(wallet.address);

                console.log("Fin obtener NFT por WhiteList");
            }

            //Ahora se quema su NFT adquirido
            for (var w of walletSigners) {
                var nftId = w.nftId;
                var wallet = w.wallet;
                var proofs = getProofs(nftId, wallet.address);

                var tx = await nftContract.connect(wallet).buyBack(nftId);
                // aqui validar que el evento se haya disparado
                await expect(tx).to.emit(nftContract, "Burn").withArgs(wallet.address, nftId);
                await expect(nftContract.ownerOf(nftId)).to.be.rejectedWith("ERC721: invalid token ID");//el registro no existe y por eso se lanza ese error

                console.log("Fin quemar NFT");
            }

            // BBTOKEN
            for (var w of walletSigners) {
                var wallet = w.wallet;

                var amount = ethers.parseEther("10000");
                var tx = await bbTokenContract.connect(relayerGoerli).mint(wallet.address, amount);
                await expect(tx).to.emit(bbTokenContract, "Transfer").withArgs(ethers.ZeroAddress, wallet.address, amount);

                console.log("Fin mint bbtokens");
            }

        });

        it("adquiere su NFT de whiteList, luego lo quema pero no se le acunia 10000 BBTokens porque esta pausado", async () => {
            // BBTOKEN
            await bbTokenContract.pause();

            // NFT
            //Primero se adquiere su NFT de la lista blanca
            for (var w of walletSigners) {
                var nftId = w.nftId;
                var wallet = w.wallet;
                var proofs = getProofs(nftId, wallet.address);

                await nftContract.connect(wallet).safeMintWhiteList(wallet.address, nftId, proofs);
                expect(await nftContract.ownerOf(nftId)).to.be.equal(wallet.address);
            }

            //Ahora se quema su NFT adquirido
            for (var w of walletSigners) {
                var nftId = w.nftId;
                var wallet = w.wallet;
                var proofs = getProofs(nftId, wallet.address);

                var tx = await nftContract.connect(wallet).buyBack(nftId);
                // aqui validar que el evento se haya disparado
                await expect(tx).to.emit(nftContract, "Burn").withArgs(wallet.address, nftId);
                await expect(nftContract.ownerOf(nftId)).to.be.rejectedWith("ERC721: invalid token ID");//el registro no existe y por eso se lanza ese error
            }

            // BBTOKEN
            for (var w of walletSigners) {
                var wallet = w.wallet;

                var amount = ethers.parseEther("10000");
                await expect(bbTokenContract.connect(relayerGoerli).mint(wallet.address, amount)).to.be.rejectedWith("Pausable: paused");
            }
        });

    });

});

