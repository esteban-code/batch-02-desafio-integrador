var { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
var { expect } = require("chai");
var { ethers, network } = require("hardhat");
const { getRole, deploySC } = require("../utils");

const { getRootFromMT, getProofs, walletAndIds } = require("../utils/merkleTree");
//import { getRootFromMT, getProofs, walletAndIds } from "../utils/merkleTree";

const MINTER_ROLE = getRole("MINTER_ROLE");
const BURNER_ROLE = getRole("BURNER_ROLE");
const PAUSER_ROLE = getRole("PAUSER_ROLE");
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

// en una terminal, se ejecuta el test con el comando: npx hardhat test .\test\test_mumbai.js

describe("Testing Desafio Integral", function () {

    async function loadMumbaiContracts() {
        var [owner, alice, bob, carl] = await ethers.getSigners();

        var name = "Cuy Collection NFT";
        var symbol = "CuyNFT";
        var nftContract = await deploySC("CuyCollectionNft", [name, symbol, owner.address, owner.address, owner.address, owner.address]);

        await nftContract.setRoot(getRootFromMT());

        return { nftContract, owner, alice, bob };
    }

    describe("Pruebas en Red Mumbai", () => {

        describe("AccessControl tests", () => {

            it("NFTContract's Owner should not mint NFTs in range 0 - 999", async () => {
                var { nftContract, owner, alice, bob } = await loadFixture(loadMumbaiContracts);
                var nftId = 1;
                await expect(nftContract.safeMint(owner.address, nftId)).to.revertedWith(`AccessControl: account ${owner.address.toLowerCase()} is missing role ${MINTER_ROLE}`);
            });

            it("Alice trying to update the Merkle Tree root", async () => {
                var { nftContract, owner, alice, bob } = await loadFixture(loadMumbaiContracts);

                await expect(nftContract.connect(alice).setRoot(getRootFromMT())).to.revertedWith(`AccessControl: account ${alice.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`);

            });

            it("Alice trying to pause the mint functionallity", async () => {
                var { nftContract, owner, alice, bob } = await loadFixture(loadMumbaiContracts);

                await expect(nftContract.connect(alice).pause()).to.revertedWith(`AccessControl: account ${alice.address.toLowerCase()} is missing role ${PAUSER_ROLE}`);

            });

        });

        describe("Pruebas de safeMintWhiteList", () => {

            it("Fuera del rango de NFT Ids", async () => {
                var { nftContract, owner, alice, bob } = await loadFixture(loadMumbaiContracts);

                var proofs = [];

                var nftId = 1;
                await expect(nftContract.safeMintWhiteList(owner.address, nftId, proofs)).to.revertedWith("El tokenId no esta dentro del rango de NFTs a repatirse en el Airdrop");

                nftId = 699;
                await expect(nftContract.safeMintWhiteList(owner.address, nftId, proofs)).to.revertedWith("El tokenId no esta dentro del rango de NFTs a repatirse en el Airdrop");

                nftId = 999;
                await expect(nftContract.safeMintWhiteList(owner.address, nftId, proofs)).to.revertedWith("El tokenId no esta dentro del rango de NFTs a repatirse en el Airdrop");
            });

            it("No forma parte de la lista blanca", async () => {
                var { nftContract, owner, alice, bob } = await loadFixture(loadMumbaiContracts);

                var nftId = 1000;

                var proofs = getProofs(nftId, owner.address);
                await expect(nftContract.safeMintWhiteList(owner.address, nftId, proofs)).to.revertedWith("No eres parte de la lista del Airdrop");

                proofs = getProofs(nftId, alice.address);
                await expect(nftContract.safeMintWhiteList(alice.address, nftId, proofs)).to.revertedWith("No eres parte de la lista del Airdrop");
            });

            it("Se adquiere NFT siendo el caller parte de la Whitelist", async () => {
                var { nftContract, owner, alice, bob } = await loadFixture(loadMumbaiContracts);

                var whiteList = walletAndIds.slice(0, 1);

                for (const object of whiteList) {//whiteList.forEach( async (object, ix) => {//No hacer uso de forEach (no entiene async/await)

                    var nftId = object.id;
                    var address = object.address;
                    var privateKey = object.privateKey;

                    var wallet = new ethers.Wallet(privateKey, ethers.provider);

                    //console.log("balance antes: " + await ethers.provider.getBalance(wallet.address))

                    await network.provider.send("hardhat_setBalance", [
                        address,
                        "0x56bc75e2d63100000"//100 ethers
                        //ethers.toBeHex(ethers.parseEther("100"))
                    ]);

                    //console.log("balance despues: " + await ethers.provider.getBalance(wallet.address));
                    
                    var proofs = getProofs(nftId, address);
                    await nftContract.connect(wallet).safeMintWhiteList(address, nftId, proofs);

                    //console.log(address);
                    //console.log(await nftContract.ownerOf(nftId));

                    expect(await nftContract.ownerOf(nftId)).to.be.equal(address);

                    console.log("Fin obtener NFT por WhiteList");

                    //});
                };

            });

            it("Se intenta volver a mintear el NFT ya adquirido o minteado (el caller es parte de la Whitelist)", async () => {
                var { nftContract, owner, alice, bob } = await loadFixture(loadMumbaiContracts);

                var whiteList = walletAndIds.slice(0, 1);

                for (const object of whiteList)
                {
                    var nftId = object.id;
                    var address = object.address;
                    var privateKey = object.privateKey;

                    await network.provider.send("hardhat_setBalance", [
                        address,
                        "0x56bc75e2d63100000"//100 ethers
                    ]);

                    var wallet = new ethers.Wallet(privateKey, ethers.provider);
                    var proofs = getProofs(nftId, address);
                    await nftContract.connect(wallet).safeMintWhiteList(address, nftId, proofs);
                    await expect(nftContract.connect(wallet).safeMintWhiteList(address, nftId, proofs)).to.be.rejectedWith("El NFT ya fue creado y adquirido");

                    console.log("Fin intento de volver a mintear NFT");
                };

            });

            it("Billtera sin ether para pagar gas", async () => {
                var { nftContract, owner, alice, bob } = await loadFixture(loadMumbaiContracts);

                var whiteList = walletAndIds.slice(0, 2);

                for (const object of whiteList) {
                    var nftId = object.id;
                    var address = object.address;
                    var privateKey = object.privateKey;

                    var proofs = getProofs(nftId, address);

                    var wallet = new ethers.Wallet(privateKey, ethers.provider);

                    console.log("balance (sin ether): " + await ethers.provider.getBalance(wallet.address))

                    await expect(nftContract.connect(wallet).safeMintWhiteList(address, nftId, proofs)).to.be.rejected;

                    await expect(nftContract.ownerOf(nftId)).to.be.revertedWith("ERC721: invalid token ID");

                    console.log("Fin sin Ether para llamar a safeMintWhiteList");
                };

            });

            it("Intento de llamar a safeMintWhiteList cuando esta pausado", async () => {
                var { nftContract, owner, alice, bob } = await loadFixture(loadMumbaiContracts);

                await nftContract.pause();

                var nftId = 1000;
                var proofs = getProofs(nftId, owner.address);
                await expect(nftContract.safeMintWhiteList(owner.address, nftId, proofs)).to.revertedWith("Pausable: paused");
            });

        });

        describe("Pruebas de buyBack", () => {

            var nftContract, owner, alice;
            var walletSigners;

            beforeEach(async () => {
                var fixtures = await loadFixture(loadMumbaiContracts);
                nftContract = fixtures.nftContract;
                owner = fixtures.owner;
                alice = fixtures.alice;

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

                console.log("address Previo: " + walletSigners[0].wallet.address);
                console.log("balance de ethers Previo: " + await ethers.provider.getBalance(walletSigners[0].wallet.address));
            });

            it("Fuera del rango de NFT Ids", async () => {
                var nftId = 1;
                await expect(nftContract.buyBack(nftId)).to.revertedWith("El id no esta dentro del rango de NFTs para realizar buyBack");

                nftId = 699;
                await expect(nftContract.buyBack(nftId)).to.revertedWith("El id no esta dentro del rango de NFTs para realizar buyBack");

                nftId = 999;
                await expect(nftContract.buyBack(nftId)).to.revertedWith("El id no esta dentro del rango de NFTs para realizar buyBack");
            });

            it("No posee el NFT a quemar", async () => {
                var nftId = 1000;
                await expect(nftContract.buyBack(nftId)).to.revertedWith("Su address no cuenta con el NFT ingresado");

                nftId = 1001;
                await expect(nftContract.buyBack(nftId)).to.revertedWith("Su address no cuenta con el NFT ingresado");

                nftId = 1002;
                await expect(nftContract.buyBack(nftId)).to.revertedWith("Su address no cuenta con el NFT ingresado");
            });

            it("Otra forma de validar que se adquiere NFT siendo el caller parte de la Whitelist", async () => {
                console.log("it A - address After: " + walletSigners[0].wallet.address);
                console.log("it A - balance de ethers After: " + await ethers.provider.getBalance(walletSigners[0].wallet.address));

                expect(await ethers.provider.getBalance(walletSigners[0].wallet.address)).to.not.be.equal(BigInt(0));

                //Primero se adquiere su NFT de la lista blanca
                for (var w of walletSigners) {
                    //console.log(w);
                    var nftId = w.nftId;
                    var wallet = w.wallet;
                    var proofs = getProofs(nftId, wallet.address);
                    //console.log(proofs);

                    //console.log("it A - previo a llamar safeMintWhiteList");
                    await nftContract.connect(wallet).safeMintWhiteList(wallet.address, nftId, proofs);
                    //console.log("it A - balance de ethers: " + await ethers.provider.getBalance(wallet.address));
                    expect(await nftContract.ownerOf(nftId)).to.be.equal(wallet.address);
                    console.log("it A - Fin obtener NFT por WhiteList");
                }
            });

            it("Se quema el NFT y se valida con el evento", async () => {
                console.log("it B - address After: " + walletSigners[0].wallet.address);
                console.log("it B - balance de ethers After: " + await ethers.provider.getBalance(walletSigners[0].wallet.address));

                expect(await ethers.provider.getBalance(walletSigners[0].wallet.address)).to.not.be.equal(BigInt(0));

                //Primero se adquiere su NFT de la lista blanca
                for (var w of walletSigners) {
                    //console.log(w);
                    var nftId = w.nftId;
                    var wallet = w.wallet;
                    var proofs = getProofs(nftId, wallet.address);
                    //console.log(proofs);
                    //console.log("it B - previo a llamar safeMintWhiteList");
                    await nftContract.connect(wallet).safeMintWhiteList(wallet.address, nftId, proofs);
                    //console.log("it B - balance de ethers: " + await ethers.provider.getBalance(wallet.address));
                    expect(await nftContract.ownerOf(nftId)).to.be.equal(wallet.address);
                    
                    console.log("it B - Fin obtener NFT por WhiteList");
                }

                //Ahora se quema su NFT adquirido
                for (var w of walletSigners) {
                    var nftId = w.nftId;
                    var wallet = w.wallet;
                    var proofs = getProofs(nftId, wallet.address);

                    var tx = await nftContract.connect(wallet).buyBack(nftId);
                    await expect(tx).to.emit(nftContract, "Burn").withArgs(wallet.address, nftId);
                    await expect(nftContract.ownerOf(nftId)).to.be.rejectedWith("ERC721: invalid token ID");//el registro no existe y por eso se lanza ese error
                    
                    console.log("it B - Fin quemar NFT");
                }
            });

            it("Validacion que se quema el NFT y que no se puede volver a mintear", async () => {
                console.log("it C - address After: " + walletSigners[0].wallet.address);
                console.log("it C - balance de ethers After: " + await ethers.provider.getBalance(walletSigners[0].wallet.address));

                expect(await ethers.provider.getBalance(walletSigners[0].wallet.address)).to.not.be.equal(BigInt(0));

                //Primero se adquiere su NFT de la lista blanca
                for (var w of walletSigners) {
                    //console.log(w);
                    var nftId = w.nftId;
                    var wallet = w.wallet;
                    var proofs = getProofs(nftId, wallet.address);
                    //console.log(proofs);

                    //console.log("it C - previo a llamar safeMintWhiteList");
                    await nftContract.connect(wallet).safeMintWhiteList(wallet.address, nftId, proofs);
                    //console.log("it C -balance de ethers: " + await ethers.provider.getBalance(wallet.address));
                    expect(await nftContract.ownerOf(nftId)).to.be.equal(wallet.address);
                    
                    console.log("it C - Fin obtener NFT por WhiteList");
                }

                //Ahora se quema su NFT adquirido
                for (var w of walletSigners) {
                    var nftId = w.nftId;
                    var wallet = w.wallet;
                    var proofs = getProofs(nftId, wallet.address);

                    var tx = await nftContract.connect(wallet).buyBack(nftId);
                    await expect(tx).to.emit(nftContract, "Burn").withArgs(wallet.address, nftId);
                    await expect(nftContract.ownerOf(nftId)).to.be.rejectedWith("ERC721: invalid token ID");
                    
                    console.log("it C - Fin quemar NFT");
                }

                //De vuelta se quiere su NFT de la lista blanca
                for (var w of walletSigners) {
                    var nftId = w.nftId;
                    var wallet = w.wallet;
                    var proofs = getProofs(nftId, wallet.address);

                    await expect(nftContract.connect(wallet).safeMintWhiteList(wallet.address, nftId, proofs)).to.be.rejectedWith("El NFT solicitado ha sido eliminado");
                    
                    console.log("it C - Fin rechazo de mintear NFT quemado");    
                }
                
            });

        });

    });


});