var { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
var { expect } = require("chai");
var { ethers, network } = require("hardhat");
var { time } = require("@nomicfoundation/hardhat-network-helpers");

const { getRole, deploySC, deploySCNoUp } = require("../utils");

const MINTER_ROLE = getRole("MINTER_ROLE");
const PAUSER_ROLE = getRole("PAUSER_ROLE");
const EXECUTER_ROLE = getRole("EXECUTER_ROLE");
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

// como hay contratos y tests que involucran llamadas al Router de Uniswap, se tiene que correr un fork de un nodo de goerli, con el comando:
// npx hardhat node --fork https://goerli.infura.io/v3/d9a8ce72510f4302afce5a62bd6627a2
// Ojo: tiene que ser un rpc de infura, con el de Alchemy sale un error que lo han explicado en: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/877
// En otra terminal, se ejecuta el test con el comando: npx hardhat --network localhost test .\test\test_goerli.js

// 00 horas del 30 de septiembre del 2023 GMT
var startDate = 1696032000;

describe("Testing Desafio Integral", function () {

    async function loadGoerliContracts() {

        //Las billeters de prueba tienen un saldo alto de Ethers (es solo de test), 
        //mientras que las wallets que se crean con new ethers.Wallet(...) si hay que enviarle ethers para que puedan llamar a metodos que consuman gas
        var [owner, alice, bob, carl] = await ethers.getSigners();

        var usdcContract = await deploySCNoUp("USDCoin", []);
        var bbTokenContract = await deploySC("BBitesToken", [owner.address, owner.address, owner.address, owner.address]);

        var usdcAddress = await usdcContract.getAddress();
        var bbTokenAddress = await bbTokenContract.getAddress();

        // console.log("usdcAddress: " + usdcAddress);
        // console.log("bbTokenAddress: " + bbTokenAddress);
        // console.log("owner.address: " + owner.address);

        var publicSaleContract = await deploySC("PublicSale", [usdcAddress, bbTokenAddress, owner.address, owner.address, owner.address]);

        var liqProviderContract = await deploySCNoUp("LiquidityProvider", []);
        var swapperContract = await deploySCNoUp("Swapper", []);

        return { usdcContract, bbTokenContract, publicSaleContract, liqProviderContract, swapperContract, owner, alice, bob };
    }

    async function creacionPoolLiquidez() {
        var { usdcContract, bbTokenContract, publicSaleContract, liqProviderContract, swapperContract, owner, alice, bob } = await loadGoerliContracts();

        var amountUsdc = await usdcContract.balanceOf(owner.address);
        var amountBBToken = await bbTokenContract.balanceOf(owner.address);

        var tx = await usdcContract.approve(await liqProviderContract.getAddress(), amountUsdc);
        var tx = await bbTokenContract.approve(await liqProviderContract.getAddress(), amountBBToken);

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

        //var poolAddress = await liqProviderContract.getPair(usdcAddress, bbTokenAddress);
        //console.log("poolAddress: " + poolAddress);

        return { usdcContract, bbTokenContract, publicSaleContract, liqProviderContract, swapperContract, owner, alice, bob };
    }

    async function mintUsdcForOwner() {
        var { usdcContract, bbTokenContract, publicSaleContract, liqProviderContract, swapperContract, owner, alice, bob } = await creacionPoolLiquidez();
        var amount = ethers.parseUnits("400000", 6);
        var tx = await usdcContract.mint(owner.address, amount);

        return { usdcContract, bbTokenContract, publicSaleContract, liqProviderContract, swapperContract, owner, alice, bob };
    }

    async function swapUsdcForBBTokens() {
        var { usdcContract, bbTokenContract, publicSaleContract, liqProviderContract, swapperContract, owner, alice, bob } = await mintUsdcForOwner();

        var usdcAddress = await usdcContract.getAddress();
        var bbTokenAddress = await bbTokenContract.getAddress();
        var swapperAddress = await swapperContract.getAddress();
        var account = owner.address;

        var amountInMaxUsdc = ethers.parseUnits("2500", 6);
        var amountOutBBToken = ethers.parseEther("2500");

        await usdcContract.approve(swapperAddress, amountInMaxUsdc);

        await swapperContract.
            swapTokensForExactTokens(
                amountOutBBToken,
                amountInMaxUsdc,
                [usdcAddress, bbTokenAddress],
                account,//el que recibe los bbtokens
                (new Date().getTime() + 60000)
            );

        //console.log("balance usdc: " + ethers.formatUnits(await usdcContract.balanceOf(owner.address), 6));
        //console.log("balance bbToken: " + ethers.formatUnits(await bbTokenContract.balanceOf(owner.address), 18));

        return { usdcContract, bbTokenContract, publicSaleContract, liqProviderContract, swapperContract, owner, alice, bob };
    }

    function buildMessageData(
        name,
        verifyingContract,
        owner,
        spender,
        value,
        nonce,
        deadline
    ) {
        const domain = {
            name,
            version: "1",
            chainId: 5,//5 (Goerli), 80001 (Mumbai)
            verifyingContract,
        };

        const types = {
            Permit: [
                {
                    name: "owner",
                    type: "address",
                },
                {
                    name: "spender",
                    type: "address",
                },
                {
                    name: "value",
                    type: "uint256",
                },
                {
                    name: "nonce",
                    type: "uint256",
                },
                {
                    name: "deadline",
                    type: "uint256",
                },
            ],
        };
        const values = {
            owner,
            spender,
            value,
            nonce,
            deadline,
        };
        return [domain, types, values];
    }

    describe("Pruebas en Red Goerli", () => {

        describe("Deployment", () => {
            it("Should assign the total supply of tokens to the owner", async () => {
                // cargando los contratos
                var { usdcContract, bbTokenContract, publicSaleContract, liqProviderContract, swapperContract, owner, alice, bob } = await loadFixture(loadGoerliContracts);
                //var usdCoins = ethers.parseUnits('500000', 6);
                //var bbTokens = ethers.parseEther('1000000');

                expect(await usdcContract.balanceOf(owner.address)).to.be.equal(await usdcContract.totalSupply(), "El balance de usdc no coincide");
                expect(await bbTokenContract.balanceOf(owner.address)).to.be.equal(await bbTokenContract.totalSupply(), "El balance de bbtoken no coincide");
            });
        });

        describe("AccessControl tests", () => {
            it("BBTokenContract's Owner should not mint BBTokens", async () => {
                var { usdcContract, bbTokenContract, publicSaleContract, liqProviderContract, swapperContract, owner, alice, bob } = await loadFixture(loadGoerliContracts);
                var amount = ethers.parseEther("1000");
                await expect(bbTokenContract.connect(owner).mint(owner.address, amount)).to.revertedWith(`AccessControl: account ${owner.address.toLowerCase()} is missing role ${MINTER_ROLE}`);
            });
            it("UsdcContract's Owner can mint USDCoins", async () => {
                var { usdcContract, bbTokenContract, publicSaleContract, liqProviderContract, swapperContract, owner, alice, bob } = await loadFixture(loadGoerliContracts);
                var balPrev = await usdcContract.totalSupply();
                var amount = ethers.parseUnits("1000", 6);
                await usdcContract.mint(owner.address, amount);
                var balAfter = await usdcContract.totalSupply();

                expect(balAfter - balPrev).to.be.equal(amount);
            });
            it("Alice can not pause in PublicSale", async () => {
                var { usdcContract, bbTokenContract, publicSaleContract, liqProviderContract, swapperContract, owner, alice, bob } = await loadFixture(loadGoerliContracts);
                await expect(publicSaleContract.connect(alice).pause()).to.revertedWith(`AccessControl: account ${alice.address.toLowerCase()} is missing role ${PAUSER_ROLE}`);
            });
        });

        describe("Purchase With BBTokens tests", () => {
            var bbTokenContract, publicSaleContract, owner, alice;
            var account, publicSaleAddress;

            beforeEach(async function () {
                var fixtures = await loadFixture(loadGoerliContracts);
                bbTokenContract = fixtures.bbTokenContract;
                publicSaleContract = fixtures.publicSaleContract;
                owner = fixtures.owner;
                alice = fixtures.alice;
                account = fixtures.owner.address;
                publicSaleAddress = await fixtures.publicSaleContract.getAddress();
            });

            it("Fuera del rango de NFT Ids", async () => {
                var nftId = 700;
                await expect(publicSaleContract.purchaseWithTokens(nftId)).to.revertedWith("El id no esta dentro del rango de NFTs para comprarlo con BBTKN tokens");

                nftId = 999;
                await expect(publicSaleContract.purchaseWithTokens(nftId)).to.revertedWith("El id no esta dentro del rango de NFTs para comprarlo con BBTKN tokens");

                nftId = 1001;
                await expect(publicSaleContract.purchaseWithTokens(nftId)).to.revertedWith("El id no esta dentro del rango de NFTs para comprarlo con BBTKN tokens");
            });

            it("PublicSale no tiene permiso sobre los BBTokens", async () => {
                var nftId = 0;
                await expect(publicSaleContract.purchaseWithTokens(nftId)).to.revertedWith("Permiso insuficiente sobre los BBTokens");

                nftId = 100;
                await expect(publicSaleContract.purchaseWithTokens(nftId)).to.revertedWith("Permiso insuficiente sobre los BBTokens");

                nftId = 199;
                await expect(publicSaleContract.purchaseWithTokens(nftId)).to.revertedWith("Permiso insuficiente sobre los BBTokens");
            });

            it("PublicSale sin permiso suficiente sobre los BBTokens", async () => {
                var nftId = 0;
                var amount = await publicSaleContract.getPriceForId(nftId); //ethers.parseEther("999");
                await bbTokenContract.approve(publicSaleAddress, amount - 1n);
                await expect(publicSaleContract.purchaseWithTokens(nftId)).to.revertedWith("Permiso insuficiente sobre los BBTokens");

                nftId = 200;
                amount = await publicSaleContract.getPriceForId(nftId);
                await bbTokenContract.approve(publicSaleAddress, amount - 1n);
                await expect(publicSaleContract.purchaseWithTokens(nftId)).to.revertedWith("Permiso insuficiente sobre los BBTokens");

                nftId = 500;
                amount = await publicSaleContract.getPriceForId(nftId);
                await bbTokenContract.approve(publicSaleAddress, amount - 1n);
                await expect(publicSaleContract.purchaseWithTokens(nftId)).to.revertedWith("Permiso insuficiente sobre los BBTokens");
            });

            it("Validacion de la compra del NFT por busqueda en mapping", async () => {
                var nftId = 0;
                var amount = await publicSaleContract.getPriceForId(nftId); //ethers.parseEther("1000");
                await bbTokenContract.approve(publicSaleAddress, amount);

                await publicSaleContract.purchaseWithTokens(nftId);
                expect(await publicSaleContract.listaNFTComprados(nftId)).to.be.equal(account);

                nftId = 200;
                amount = await publicSaleContract.getPriceForId(nftId);
                await bbTokenContract.approve(publicSaleAddress, amount);

                await publicSaleContract.purchaseWithTokens(nftId);
                expect(await publicSaleContract.listaNFTComprados(nftId)).to.be.equal(account);

                nftId = 500;
                amount = await publicSaleContract.getPriceForId(nftId);
                await bbTokenContract.approve(publicSaleAddress, amount);

                await publicSaleContract.purchaseWithTokens(nftId);
                expect(await publicSaleContract.listaNFTComprados(nftId)).to.be.equal(account);
            });

            it("Validacion de la compra del NFT por evento", async () => {

                var nftId = 0;
                var amount = await publicSaleContract.getPriceForId(nftId); //ethers.parseEther("1000");
                await bbTokenContract.approve(publicSaleAddress, amount);

                var tx = await publicSaleContract.purchaseWithTokens(nftId);
                await expect(tx).to.emit(publicSaleContract, "PurchaseNftWithId").withArgs(account, nftId);

                nftId = 200;
                amount = await publicSaleContract.getPriceForId(nftId);
                await bbTokenContract.approve(publicSaleAddress, amount);

                tx = await publicSaleContract.purchaseWithTokens(nftId);
                await expect(tx).to.emit(publicSaleContract, "PurchaseNftWithId").withArgs(account, nftId);

                nftId = 500;
                amount = await publicSaleContract.getPriceForId(nftId);
                await bbTokenContract.approve(publicSaleAddress, amount);

                tx = await publicSaleContract.purchaseWithTokens(nftId);
                await expect(tx).to.emit(publicSaleContract, "PurchaseNftWithId").withArgs(account, nftId);

            });

            it("Alice intenta comprar un NFT que ya fue comprado por el owner", async () => {
                var nftId = 0;
                var amount = await publicSaleContract.getPriceForId(nftId); //ethers.parseEther("1000");

                await bbTokenContract.approve(publicSaleAddress, amount);
                await publicSaleContract.purchaseWithTokens(nftId);
                expect(await publicSaleContract.listaNFTComprados(nftId)).to.be.equal(account);

                await bbTokenContract.transfer(alice.address, amount);
                await bbTokenContract.connect(alice).approve(publicSaleAddress, amount);
                await expect(publicSaleContract.connect(alice).purchaseWithTokens(nftId)).to.revertedWith("El NFT ya fue comprado");

            });
        });

        describe("Creacion de Pool de Liquidez", () => {

            var liqProviderContract;
            var usdcAddress, bbTokenAddress;

            before(async function () {
                var fixtures = await loadFixture(creacionPoolLiquidez);

                liqProviderContract = fixtures.liqProviderContract;
                usdcAddress = await fixtures.usdcContract.getAddress();
                bbTokenAddress = await fixtures.bbTokenContract.getAddress();

            });

            it("Existe Pool Liquidity", async () => {
                var poolAddress = await liqProviderContract.getPair(usdcAddress, bbTokenAddress);
                //console.log("poolAddress: " + poolAddress);
                expect(poolAddress).not.to.be.equal(ethers.ZeroAddress); // "0x0000000000000000000000000000000000000000"

            });

        });

        describe("Mint", () => {
            it("Owner mint USDC despues de dar todos sus USDC al pool", async () => {
                var { usdcContract, bbTokenContract, publicSaleContract, liqProviderContract, swapperContract, owner, alice, bob } = await loadFixture(creacionPoolLiquidez);

                var balanceUsdcBefore = await usdcContract.balanceOf(owner.address);

                var amount = ethers.parseUnits("400000", 6);
                var tx = await usdcContract.mint(owner.address, amount);

                var balanceUsdcAfter = await usdcContract.balanceOf(owner.address);

                expect(balanceUsdcAfter - balanceUsdcBefore).to.be.equal(amount);

            });

        });

        describe("Swapper", () => {

            var usdcContract, bbTokenContract, swapperContract, owner;
            var account, usdcAddress, bbTokenAddress, swapperAddress;

            beforeEach(async function () {
                var fixtures = await loadFixture(mintUsdcForOwner);
                usdcContract = fixtures.usdcContract;
                bbTokenContract = fixtures.bbTokenContract;
                swapperContract = fixtures.swapperContract;
                owner = fixtures.owner;
                account = fixtures.owner.address;
                usdcAddress = await fixtures.usdcContract.getAddress();
                bbTokenAddress = await fixtures.bbTokenContract.getAddress();
                swapperAddress = await fixtures.swapperContract.getAddress();
            });

            it("Owner da una cantidad exacta de Uscd para obtener un minimo de BBTokens", async () => {

                var balanceBBTokenBefore = await bbTokenContract.balanceOf(owner.address);

                var amountInUscd = ethers.parseUnits("2500", 6);
                var amountOutMinBBToken = ethers.parseEther("2500");

                await usdcContract.approve(swapperAddress, amountInUscd);

                await swapperContract.
                    swapExactTokensForTokens(
                        amountInUscd,
                        amountOutMinBBToken,
                        [usdcAddress, bbTokenAddress],
                        owner.address,//el que recibe los bbtokens
                        (new Date().getTime() + 60000)
                    );

                var balanceBBTokenAfter = await bbTokenContract.balanceOf(owner.address);

                // console.log("balanceBBTokenBefore : " + ethers.formatUnits(balanceBBTokenBefore, 18));
                // console.log("balanceBBTokenAfter : " + ethers.formatUnits(balanceBBTokenAfter, 18));

                expect(balanceBBTokenAfter - balanceBBTokenBefore).to.be.greaterThanOrEqual(amountOutMinBBToken);

            });

            it("Owner ofrece un maximo de Uscd para obtener una cantidad exacta de BBTokens", async () => {

                var balanceUsdcBefore = await usdcContract.balanceOf(owner.address);

                var amountInMaxUsdc = ethers.parseUnits("2500", 6);
                var amountOutBBToken = ethers.parseEther("2500");

                await usdcContract.approve(swapperAddress, amountInMaxUsdc);

                await swapperContract.
                    swapTokensForExactTokens(
                        amountOutBBToken,
                        amountInMaxUsdc,
                        [usdcAddress, bbTokenAddress],
                        account,//el que recibe los bbtokens
                        (new Date().getTime() + 60000)
                    );

                var balanceUsdcAfter = await usdcContract.balanceOf(owner.address);

                // console.log("balanceUsdcBefore : " + ethers.formatUnits(balanceUsdcBefore, 6));
                // console.log("balanceUsdcAfter : " + ethers.formatUnits(balanceUsdcAfter, 6));
                // console.log("udsc swapped: " + ethers.formatUnits(balanceUsdcBefore - balanceUsdcAfter, 6))

                expect(balanceUsdcBefore - balanceUsdcAfter).to.be.lessThanOrEqual(amountInMaxUsdc);

            });

        });

        describe("PublicSale - getPrice Tests", () => {
            it("getPrice", async () => {
                var { usdcContract, bbTokenContract, publicSaleContract } = await loadGoerliContracts();

                var nftId = "500";

                var precio = await publicSaleContract.getPriceForId(nftId);
                //console.log("precio:", precio);

                const MAX_PRICE_NFT = 90000;
                var diff = Math.floor(((new Date() / 1000) - startDate) / 60 / 60 / 24);//pregunta: en Solidity lo redondea por defecto? es floor/ceil/round?
                var price = 10000 + (2000 * diff);
                if (price >= MAX_PRICE_NFT) {
                    price = MAX_PRICE_NFT;
                }
                var precioCalc = ethers.parseEther(price.toString());

                expect(precio).to.be.equal(precioCalc);
                //console.log("precioCalc:", precioCalc);
            });
        });

        describe("Purchase With USDC tests", () => {
            var usdcContract, bbTokenContract, publicSaleContract, owner, alice;
            var account, publicSaleAddress;

            beforeEach(async function () {
                var fixtures = await loadFixture(swapUsdcForBBTokens);
                usdcContract = fixtures.usdcContract;
                bbTokenContract = fixtures.bbTokenContract;
                publicSaleContract = fixtures.publicSaleContract;
                owner = fixtures.owner;
                alice = fixtures.alice;
                account = fixtures.owner.address;
                publicSaleAddress = await fixtures.publicSaleContract.getAddress();
            });

            it("Fuera del rango de NFT Ids", async () => {
                var amount = ethers.parseUnits("50000", 6);

                var nftId = 700;
                await expect(publicSaleContract.purchaseWithUSDC(nftId, amount)).to.revertedWith("El id no esta dentro del rango de NFTs para comprarlo con USDCoins");

                nftId = 999;
                await expect(publicSaleContract.purchaseWithUSDC(nftId, amount)).to.revertedWith("El id no esta dentro del rango de NFTs para comprarlo con USDCoins");

                nftId = 1001;
                await expect(publicSaleContract.purchaseWithUSDC(nftId, amount)).to.revertedWith("El id no esta dentro del rango de NFTs para comprarlo con USDCoins");
            });

            it("PublicSale no tiene permiso sobre los USDCoins", async () => {
                var nftId = 0;
                var amount = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);

                // si estimateUSDCoinsForExactBBTokens emite un evento con el amount, ya no es view, y requiere de firma por el gasto del gas,
                // y la funcion a pesar de tener 'return', no retorna el amount de forma directa a la web 2.0

                // var tx = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);
                // var response = await tx.wait();
                // var amount = parseInt(response.logs[0].data, 16); // ethers.parseUnits("800", 6); ---> para 1000 bbtokens, es un aprox de 500 y pico usdc

                await expect(publicSaleContract.purchaseWithUSDC(nftId, amount)).to.revertedWith("Permiso insuficiente sobre los USDCoins");

                nftId = 200;
                amount = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);

                await expect(publicSaleContract.purchaseWithUSDC(nftId, amount)).to.revertedWith("Permiso insuficiente sobre los USDCoins");

                nftId = 500;
                amount = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);

                await expect(publicSaleContract.purchaseWithUSDC(nftId, amount)).to.revertedWith("Permiso insuficiente sobre los USDCoins");
            });

            it("PublicSale sin permiso suficiente sobre los USDCoins", async () => {
                var nftId = 0;
                var amount = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);

                // si estimateUSDCoinsForExactBBTokens emite un evento con el amount, ya no es view, y requiere de firma,
                // y la funcion a pesar de tener 'return', no retorna el amount de forma directa a la web 2.0

                // var tx = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);
                // var response = await tx.wait();
                // var amount = parseInt(response.logs[0].data, 16); // ethers.parseUnits("80", 6); ---> para 1000 bbtokens, es un aprox de 500 y pico usdc
                // await usdcContract.approve(publicSaleAddress, amount - 1);

                await usdcContract.approve(publicSaleAddress, amount - 1n);
                await expect(publicSaleContract.purchaseWithUSDC(nftId, amount)).to.revertedWith("Permiso insuficiente sobre los USDCoins");

                nftId = 200;
                amount = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);

                await usdcContract.approve(publicSaleAddress, amount - 1n);
                await expect(publicSaleContract.purchaseWithUSDC(nftId, amount)).to.revertedWith("Permiso insuficiente sobre los USDCoins");

                nftId = 500;
                amount = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);

                await usdcContract.approve(publicSaleAddress, amount - 1n);
                await expect(publicSaleContract.purchaseWithUSDC(nftId, amount)).to.revertedWith("Permiso insuficiente sobre los USDCoins");
            });

            it("Maximo usdc a ser entregado, no suficiente para la compra", async () => {
                var nftId = 0;
                var amount = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);

                await usdcContract.approve(publicSaleAddress, amount);
                await expect(publicSaleContract.purchaseWithUSDC(nftId, amount - 1n)).to.revertedWith("UniswapV2Router: EXCESSIVE_INPUT_AMOUNT");
            });

            it("Estimacion de usdc por una cantidad exacta de BBTokens", async () => {
                var nftId = 0;

                var amountCalc = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);
                //console.log("amountCalc: " + amountCalc);

                const routerAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
                const abi = [
                    "function getAmountsIn(uint amountOut, address[] memory path) public view returns (uint[] memory amounts)"
                ];
                const routerContract = new ethers.Contract(routerAddress, abi, ethers.provider);

                var amountOut = await publicSaleContract.getPriceForId(nftId); // para obtener nftId=0 son 1000 bbtokens => ethers.parseEther("1000");
                var amounts = await routerContract.getAmountsIn(amountOut, [await usdcContract.getAddress(), await bbTokenContract.getAddress()]);
                //console.log(amounts);

                expect(amountCalc).to.be.equals(amounts[0]);

            });

            it("Validacion de la compra del NFT por busqueda en mapping", async () => {
                var nftId = 0;
                var amount = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);

                await usdcContract.approve(publicSaleAddress, amount);
                await publicSaleContract.purchaseWithUSDC(nftId, amount);

                expect(await publicSaleContract.listaNFTComprados(nftId)).to.be.equal(account);
            });

            it("Validacion de la compra del NFT por evento", async () => {
                var nftId = 0;
                var amount = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);

                await usdcContract.approve(publicSaleAddress, amount);
                var tx = await publicSaleContract.purchaseWithUSDC(nftId, amount);

                await expect(tx).to.emit(publicSaleContract, "PurchaseNftWithId").withArgs(account, nftId);
            });

            it("Validacion de reembolso de USDCoins en exceso en compra", async () => {
                var balanceUscdPrev = await usdcContract.balanceOf(owner.address);

                var nftId = 0;
                var amountCalc = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);

                var exceso = 1n;
                var amount = amountCalc + exceso;
                await usdcContract.approve(publicSaleAddress, amount);

                await publicSaleContract.purchaseWithUSDC(nftId, amount);

                var balanceUscdAfter = await usdcContract.balanceOf(owner.address);

                if (exceso > 0) {
                    expect(balanceUscdPrev - balanceUscdAfter).to.be.lessThan(amount);
                }
                expect(balanceUscdPrev - balanceUscdAfter).to.be.equals(amountCalc);

            });

            it("Alice intenta comprar un NFT que ya fue comprado por el owner", async () => {
                var nftId = 0;
                var amount = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);

                await usdcContract.approve(publicSaleAddress, amount);
                await publicSaleContract.purchaseWithUSDC(nftId, amount);

                expect(await publicSaleContract.listaNFTComprados(nftId)).to.be.equal(account);

                await usdcContract.transfer(alice.address, amount);//le transfiero a Alice usdCoins para que ella compre tambien

                await usdcContract.connect(alice).approve(publicSaleAddress, amount);
                await expect(publicSaleContract.connect(alice).purchaseWithUSDC(nftId, amount)).to.revertedWith("El NFT ya fue comprado");

            });
        });

        describe("Purchase With Ether tests", () => {
            var usdcContract, publicSaleContract, owner, alice;
            var account, publicSaleAddress;

            beforeEach(async function () {
                var fixtures = await loadFixture(swapUsdcForBBTokens);
                usdcContract = fixtures.usdcContract;
                publicSaleContract = fixtures.publicSaleContract;
                owner = fixtures.owner;
                alice = fixtures.alice;
                account = fixtures.owner.address;
                publicSaleAddress = await fixtures.publicSaleContract.getAddress();
            });

            it("Fuera del rango de NFT Ids", async () => {
                var nftId = 0;
                await expect(publicSaleContract.purchaseWithEtherAndId(nftId)).to.revertedWith("El id no esta dentro del rango de NFTs para comprarlo con Ether");

                nftId = 699;
                await expect(publicSaleContract.purchaseWithEtherAndId(nftId)).to.revertedWith("El id no esta dentro del rango de NFTs para comprarlo con Ether");

                nftId = 1000;
                await expect(publicSaleContract.purchaseWithEtherAndId(nftId)).to.revertedWith("El id no esta dentro del rango de NFTs para comprarlo con Ether");
            });

            it("No se ha enviado ethers suficiente", async () => {
                var amount = ethers.parseEther("0.01");
                var nftId = 700;
                await expect(publicSaleContract.purchaseWithEtherAndId(nftId, { value: amount })).to.revertedWith("No se ha enviado suficiente ether para comprar el NFT");

                amount = ethers.parseEther("0.05");
                nftId = 800;
                await expect(publicSaleContract.purchaseWithEtherAndId(nftId, { value: amount })).to.revertedWith("No se ha enviado suficiente ether para comprar el NFT");

                amount = ethers.parseEther("0.099999");
                nftId = 999;
                await expect(publicSaleContract.purchaseWithEtherAndId(nftId, { value: amount })).to.revertedWith("No se ha enviado suficiente ether para comprar el NFT");
            });

            it("Validacion de la compra del NFT por busqueda en mapping", async () => {
                var amount = ethers.parseEther("0.1");
                var nftId = 700;
                await publicSaleContract.purchaseWithEtherAndId(nftId, { value: amount });
                expect(await publicSaleContract.listaNFTComprados(nftId)).to.be.equal(account);
            });

            it("Validacion de la compra del NFT por evento", async () => {
                var amount = ethers.parseEther("0.1");
                var nftId = 700;
                var tx = await publicSaleContract.purchaseWithEtherAndId(nftId, { value: amount });
                await expect(tx).to.emit(publicSaleContract, "PurchaseNftWithId").withArgs(account, nftId);
            });

            it("Validacion de reembolso de ethers en exceso en compra", async () => {
                //console.log("balance prev de ether:" + ethers.formatEther(await ethers.provider.getBalance(owner.address)));
                var balanceEtherPrev = await ethers.provider.getBalance(owner.address);

                var amount = ethers.parseEther("1.5");
                var nftId = 700;
                var tx = await publicSaleContract.purchaseWithEtherAndId(nftId, { value: amount });
                const receipt = await tx.wait();
                //console.log(receipt);
                const gasCostForTxn = receipt.gasUsed * (receipt.gasPrice);
                //console.log(receipt.gasPrice);
                //console.log(receipt.effectiveGasPrice);//no existe para ethers v.6
                //console.log("balance after de ether:" + ethers.formatEther(await ethers.provider.getBalance(owner.address)));
                var balanceEtherAfter = await ethers.provider.getBalance(owner.address);

                expect(balanceEtherPrev - balanceEtherAfter).to.be.equal(ethers.parseEther("0.1") + gasCostForTxn);
            });

            it("Alice intenta comprar un NFT que ya fue comprado por el owner", async () => {
                var amount = ethers.parseEther("0.1");
                var nftId = 700;
                await publicSaleContract.purchaseWithEtherAndId(nftId, { value: amount });

                await expect(publicSaleContract.connect(alice).purchaseWithEtherAndId(nftId, { value: amount })).to.revertedWith("El NFT ya fue comprado");
            });


        });

        describe("Purchase Randomly With Ether tests", () => {
            var usdcContract, publicSaleContract, owner, alice;
            var account, publicSaleAddress;

            beforeEach(async function () {
                var fixtures = await loadFixture(swapUsdcForBBTokens);
                usdcContract = fixtures.usdcContract;
                publicSaleContract = fixtures.publicSaleContract;
                owner = fixtures.owner;
                alice = fixtures.alice;
                account = fixtures.owner.address;
                publicSaleAddress = await fixtures.publicSaleContract.getAddress();
            });

            it("No se ha enviado ethers suficiente", async () => {
                var amount = ethers.parseEther("0.01");
                await expect(owner.sendTransaction({ to: publicSaleAddress, value: amount })).to.revertedWith("No se ha enviado suficiente ether para comprar el NFT");

                amount = ethers.parseEther("0.05");
                await expect(owner.sendTransaction({ to: publicSaleAddress, value: amount })).to.revertedWith("No se ha enviado suficiente ether para comprar el NFT");

                amount = ethers.parseEther("0.099999");
                await expect(owner.sendTransaction({ to: publicSaleAddress, value: amount })).to.revertedWith("No se ha enviado suficiente ether para comprar el NFT");
            });

            //No se puede: Validacion de la compra del NFT por busqueda en mapping

            it("Validacion de la compra del NFT por evento", async () => {
                var amount = ethers.parseEther("0.1");

                //No usar .on(), pues en algunas corridas del test produce error, parece que se ejecuta internamente cuando ya se esta por un 'it' mas de adelante

                // publicSaleContract.on("PurchaseNftWithId", async (account, id) => {
                //     expect(account).to.be.equal(owner.address);
                //     expect(await publicSaleContract.listaNFTComprados(id)).to.be.equal(owner.address);
                //     console.log("evento PurchaseNftWithId disparado");
                // });

                var tx = await owner.sendTransaction({ to: publicSaleAddress, value: amount });
                await expect(tx).to.emit(publicSaleContract, "PurchaseNftWithId");//no se sabe el argumento de nftId
                console.log("paso el test con evento sin indicarle los argumentos");
            });

            it("Validacion de reembolso de ethers en exceso en compra", async () => {
                var balanceEtherPrev = await ethers.provider.getBalance(owner.address);

                var amount = ethers.parseEther("1.5");
                var tx = await owner.sendTransaction({ to: publicSaleAddress, value: amount });
                const receipt = await tx.wait();
                const gasCostForTxn = receipt.gasUsed * (receipt.gasPrice);
                var balanceEtherAfter = await ethers.provider.getBalance(owner.address);

                expect(balanceEtherPrev - balanceEtherAfter).to.be.equal(ethers.parseEther("0.1") + gasCostForTxn);
            });

            //No se puede testear el siguiente 'it'
            it("Alice intenta comprar un NFT que ya fue comprado por el owner", async () => {
                var amount = ethers.parseEther("0.1");

                //No usar .on(), pues en algunas corridas del test produce error, parece que se ejecuta internamente cuando ya se esta por un 'it' mas de adelante

                // publicSaleContract.on("PurchaseNftWithId", async (account, id) => {
                //     expect(await publicSaleContract.connect(alice).purchaseWithEtherAndId(id, { value: amount })).to.revertedWith("El NFT ya fue comprado");
                //     console.log("evento PurchaseNftWithId disparado");
                // });

                var tx = await owner.sendTransaction({ to: publicSaleAddress, value: amount });
                await expect(tx).to.emit(publicSaleContract, "PurchaseNftWithId");//no se sabe el argumento de nftId
                //console.log("paso el test con evento sin indicarle los argumentos");
            });

        });

        describe("Withdraw Ether", () => {
            var publicSaleContract, owner, alice;
            var account;

            beforeEach(async function () {
                var fixtures = await loadFixture(swapUsdcForBBTokens);
                publicSaleContract = fixtures.publicSaleContract;
                owner = fixtures.owner;
                alice = fixtures.alice;
                account = fixtures.owner.address;
            });

            it("Sin permisos para hacer withdraw", async () => {
                var nftId = 700;
                var amount = ethers.parseEther("0.1");

                await publicSaleContract.purchaseWithEtherAndId(nftId, { value: amount });

                await expect(publicSaleContract.connect(alice).withdrawEther()).to.revertedWith(`AccessControl: account ${alice.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`);
            });

            it("Verificar monto de withdraw", async () => {
                var balanceEtherPrev = await ethers.provider.getBalance(owner.address);

                var nftId = 700;
                var amount = ethers.parseEther("0.1"); // "1.5"

                var tx = await publicSaleContract.purchaseWithEtherAndId(nftId, { value: amount });
                var receipt = await tx.wait();
                var gasCostForTxn = receipt.gasUsed * receipt.gasPrice;

                var balanceEtherAfter = await ethers.provider.getBalance(owner.address);

                var ethersSendToPublicSale = balanceEtherPrev - balanceEtherAfter - gasCostForTxn;

                tx = await publicSaleContract.withdrawEther();
                receipt = await tx.wait();
                gasCostForTxn = receipt.gasUsed * receipt.gasPrice;

                var balanceEtherAfterWithdraw = await ethers.provider.getBalance(owner.address);

                var amountWithdraw = balanceEtherAfterWithdraw + gasCostForTxn - balanceEtherAfter;

                expect(amountWithdraw).to.equal(ethersSendToPublicSale);

            });
        });

        describe("Withdraw BBTokens", () => {

            var bbTokenContract, publicSaleContract, owner, alice;
            var account, publicSaleAddress;

            beforeEach(async function () {
                var fixtures = await loadFixture(loadGoerliContracts);
                bbTokenContract = fixtures.bbTokenContract;
                publicSaleContract = fixtures.publicSaleContract;
                owner = fixtures.owner;
                alice = fixtures.alice;
                account = fixtures.owner.address;
                publicSaleAddress = await fixtures.publicSaleContract.getAddress();
            });

            it("Sin permisos para hacer withdraw", async () => {
                var nftId = 0;
                var amount = await publicSaleContract.getPriceForId(nftId); //ethers.parseEther("1000");

                await bbTokenContract.approve(publicSaleAddress, amount);

                await publicSaleContract.purchaseWithTokens(nftId);

                await expect(publicSaleContract.connect(alice).withdrawTokens()).to.revertedWith(`AccessControl: account ${alice.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`);
            });

            it("Verificar monto de withdraw", async () => {
                var balancePrev = await bbTokenContract.balanceOf(owner.address);

                var nftId = 0;
                var amount = await publicSaleContract.getPriceForId(nftId); //ethers.parseEther("1000");
                await bbTokenContract.approve(publicSaleAddress, amount);
                await publicSaleContract.purchaseWithTokens(nftId);

                var balanceAfter = await bbTokenContract.balanceOf(owner.address);

                await publicSaleContract.withdrawTokens();

                var balanceAfterWithdraw = await bbTokenContract.balanceOf(owner.address);

                expect(balanceAfterWithdraw - balanceAfter).to.equal(balancePrev - balanceAfter);

            });
        });

        describe("Firma Digital ERC20Permit", () => {

            var bbTokenContract, publicSaleContract, owner, alice;
            var account, bbTokenAddress, publicSaleAddress;

            beforeEach(async function () {
                var fixtures = await loadFixture(loadGoerliContracts);
                bbTokenContract = fixtures.bbTokenContract;
                publicSaleContract = fixtures.publicSaleContract;
                owner = fixtures.owner;
                alice = fixtures.alice;
                account = fixtures.owner.address;
                bbTokenAddress = await fixtures.bbTokenContract.getAddress();
                publicSaleAddress = await fixtures.publicSaleContract.getAddress();

            });

            it("Permit con error", async () => {
                

                const tokenName = await bbTokenContract.name();
                const nonce = await bbTokenContract.nonces(owner.address);
                const amount = ethers.parseEther("1000").toString();
                const deadline = Math.round(Date.now() / 1000) + 60 * 10; // 10 min

                const [domain, types, values] = buildMessageData(
                    tokenName,
                    bbTokenAddress,//Address del token que implementa ERC20Permit
                    owner.address,//ownerAddress
                    publicSaleAddress,//spenderAddress
                    amount,
                    nonce.toString(),
                    deadline
                );
                console.log(JSON.stringify([domain, types, values]));

                var sigData = await owner.signTypedData(domain, types, values);
                // Se separa la firma en sus componentes v, r y s
                var splitSignature = ethers.Signature.from(sigData);
                var { v, r, s } = splitSignature;

                console.log("ownerAddress:", owner.address);
                console.log("spenderAddress:", publicSaleAddress);
                console.log("value:", amount);
                console.log("deadline:", deadline);
                console.log("v:", v);
                console.log("r:", r);
                console.log("s:", s);



                const recovered = ethers.verifyTypedData(
                    domain,
                    types,
                    values,
                    splitSignature
                );
                //ethers.
                //console.log(hre.network.config.chainId);
                console.log(owner.address);
                console.log("Address recuperada de firma:", recovered);

                await publicSaleContract.grantRole(EXECUTER_ROLE, owner.address);//para poder invocar a executePermitAndPurchase

                // expect( 
                await publicSaleContract.executePermitAndPurchase(
                    owner.address,
                    publicSaleAddress,
                    amount,
                    deadline,
                    v,
                    r,
                    s
                );
                // ).to.be.revertedWith("xxx");

            });

            it("Permit correcto", async () => {

            });



        });

    });

});
