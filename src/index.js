//en una terminal ejecutar el comando: npm start

import { Contract, ethers } from "ethers";

import usdcJson from "../artifacts/contracts/USDCoin.sol/USDCoin.json";
import bbTokenJson from "../artifacts/contracts/BBitesToken.sol/BBitesToken.json";
import publicSaleJson from "../artifacts/contracts/PublicSale.sol/PublicSale.json";
import nftJson from "../artifacts/contracts/CuyCollectionNft.sol/CuyCollectionNft.json";
import liqProviderJson from "../artifacts/contracts/LiquidityProvider.sol/LiquidityProvider.json";
import swapperJson from "../artifacts/contracts/Swapper.sol/Swapper.json"

import config from "../scripts/config.json";

// SUGERENCIA: vuelve a armar el MerkleTree en frontend
// Utiliza la libreria buffer
import buffer from "buffer/";
import walletAndIds from "../wallets/walletList";
import { MerkleTree } from "merkletreejs";
var Buffer = buffer.Buffer;
var merkleTree;

function hashToken(tokenId, account) {
  return Buffer.from(
    ethers
      .solidityPackedKeccak256(["uint256", "address"], [tokenId, account])
      .slice(2),
    "hex"
  );
}

function buildMerkleTree() {
  var elementosHasheados = walletAndIds.map(({ id, address }) => {
    return hashToken(id, address);
  });
  merkleTree = new MerkleTree(elementosHasheados, ethers.keccak256, {
    sortPairs: true,
  });
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

var provider, signer, account;

var usdcContract, bbTokenContract, publicSaleContract, liqProviderContract, swapperContract, nftContract;

var usdcAddress, bbTokenAddress;
var publicSaleAddress, liqProviderAddress, nftAddress;
var poolAddress;
var swapperAddress;

function initSCsGoerli() {
  provider = new ethers.BrowserProvider(window.ethereum);

  var obj = config.addresses;
  usdcAddress = obj.usdcAddress; // "0x6492Ad51217109F539D3DC3Ae9056e26b9A6B62D";
  bbTokenAddress = obj.bbTokenAddress; // "0x180e185F2867a486eBcd44bEcD9EE02eC02f4d7b";
  publicSaleAddress = obj.publicSaleAddress; // "0x4312384909c6A6742CF1727D9aCdc78B4A4d5001";
  liqProviderAddress = obj.liqProviderAddress; // "0x76AbA026905ccb05e701e7E71d0a61740112801A";
  swapperAddress = obj.swapperAddress; // "0x5bc4A8902852C0f1661B60589f7c8AD9E846521d";

  usdcContract = new Contract(usdcAddress, usdcJson.abi, provider);
  bbTokenContract = new Contract(bbTokenAddress, bbTokenJson.abi, provider);
  publicSaleContract = new Contract(publicSaleAddress, publicSaleJson.abi, provider);
  liqProviderContract = new Contract(liqProviderAddress, liqProviderJson.abi, provider);
  swapperContract = new Contract(swapperAddress, swapperJson.abi, provider);

}

function initSCsMumbai() {
  provider = new ethers.BrowserProvider(window.ethereum);

  var obj = config.addresses;
  nftAddress = obj.nftAddress; // "0xbAB10fFbc44C5d950db16889e165132e616e8Adc";

  nftContract = new Contract(nftAddress, nftJson.abi, provider);
}


function setUpListeners() {

  // Connect to Metamask
  var bttn = document.getElementById("connect");
  bttn.addEventListener("click", async function () {
    
    if(!window.ethereum) {
      alert("Instale la extension Metamask y refresque la pagina");
      return;
    }

    //debugger;

    // obtiene la cuenta o billetera metamask que este conectada con la pagina (http://localhost:8080)
    // si hay mas de 1 cuenta conectada con la pagina, obtiene en el orden como aparecen las cuentas en metamask conectados a la pagina, y lo setea en el array
    // solo abre el popup de metamask cuando:
    // - si no se ha iniciado sesion con metamask
    // - si no hay ninguna cuenta conectado con la pagina web
    // si se cancela el popup para conectar a alguna cuenta de metamask, se lanza un error, deberia estar envuelto en un try-catch
    var cuentaAux, cuentaAux2;
    [account, cuentaAux, cuentaAux2] = await ethereum.request({
      method: "eth_requestAccounts",
    });

    console.log("Billetera metamask", account);

    signer = await provider.getSigner(account);
    
    var walletId = document.getElementById("walletId");
    walletId.innerHTML = account;
  });

  var bttn = document.getElementById("refreshBalances");
  bttn.addEventListener("click", async function () {

    var walletUsdcBalance = document.getElementById("walletUsdcBalance");
    var walletBBTokenBalance = document.getElementById("walletBBTokenBalance");
    var walletEtherBalance = document.getElementById("walletEtherBalance");

    var liqProviderUsdcBalance = document.getElementById("liqProviderUsdcBalance");
    var liqProviderBBTokenBalance = document.getElementById("liqProviderBBTokenBalance");
    var liqProviderEtherBalance = document.getElementById("liqProviderEtherBalance");

    var swapperUsdcBalance = document.getElementById("swapperUsdcBalance");
    var swapperBBTokenBalance = document.getElementById("swapperBBTokenBalance");
    var swapperEtherBalance = document.getElementById("swapperEtherBalance");

    var publisSaleUsdcBalance = document.getElementById("publisSaleUsdcBalance");
    var publicSaleBBTokenBalance = document.getElementById("publicSaleBBTokenBalance");
    var publicSaleEtherBalance = document.getElementById("publicSaleEtherBalance");

    var poolUsdcBalance = document.getElementById("poolUsdcBalance");
    var poolBBTokenBalance = document.getElementById("poolBBTokenBalance");
    var poolEtherBalance = document.getElementById("poolEtherBalance");

    var error_refreshBalances = document.getElementById("error_refreshBalances");
    error_refreshBalances.innerHTML = "";

    var balance;
    try {
      balance = await usdcContract.balanceOf(account);
      walletUsdcBalance.innerHTML = ethers.formatUnits(balance, 6);

      balance = await bbTokenContract.balanceOf(account);
      walletBBTokenBalance.innerHTML = ethers.formatUnits(balance, 18);

      balance = await provider.getBalance(account);
      walletEtherBalance.innerHTML = ethers.formatUnits(balance, 18);

      balance = await usdcContract.balanceOf(publicSaleAddress);
      publisSaleUsdcBalance.innerHTML = ethers.formatUnits(balance, 6);

      balance = await bbTokenContract.balanceOf(publicSaleAddress);
      publicSaleBBTokenBalance.innerHTML = ethers.formatUnits(balance, 18);

      balance = await provider.getBalance(publicSaleAddress);
      publicSaleEtherBalance.innerHTML = ethers.formatUnits(balance, 18);

      balance = await usdcContract.balanceOf(liqProviderAddress);
      liqProviderUsdcBalance.innerHTML = ethers.formatUnits(balance, 6);

      balance = await bbTokenContract.balanceOf(liqProviderAddress);
      liqProviderBBTokenBalance.innerHTML = ethers.formatUnits(balance, 18);

      balance = await provider.getBalance(liqProviderAddress);
      liqProviderEtherBalance.innerHTML = ethers.formatUnits(balance, 18);

      balance = await usdcContract.balanceOf(swapperAddress);
      swapperUsdcBalance.innerHTML = ethers.formatUnits(balance, 6);

      balance = await bbTokenContract.balanceOf(swapperAddress);
      swapperBBTokenBalance.innerHTML = ethers.formatUnits(balance, 18);

      balance = await provider.getBalance(swapperAddress);
      swapperEtherBalance.innerHTML = ethers.formatUnits(balance, 18);

      if (poolAddress == "0x0000000000000000000000000000000000000000") {
        poolUsdcBalance.innerHTML = "No existe aun el pool de liquidez";
        poolBBTokenBalance.innerHTML = "No existe aun el pool de liquidez";
        poolEtherBalance.innerHTML = "No existe aun el pool de liquidez";
      }
      else {
        balance = await usdcContract.balanceOf(poolAddress);
        poolUsdcBalance.innerHTML = ethers.formatUnits(balance, 6);

        balance = await bbTokenContract.balanceOf(poolAddress);
        poolBBTokenBalance.innerHTML = ethers.formatUnits(balance, 18);

        balance = await provider.getBalance(poolAddress);
        poolEtherBalance.innerHTML = ethers.formatUnits(balance, 18);

      }

    } catch (error) {
      console.log(error);
      error_refreshBalances.innerHTML = error.message;
    }
  });

  //Crear pool de liquidez
  var bttn = document.getElementById("crearPoolLiqBtn");
  bttn.addEventListener("click", async function () {
    var amountUsdc = document.getElementById("poolInputUSDC").value;
    var amountBBToken = document.getElementById("poolInputBBToken").value;
    var crearPoolLiqAddress = document.getElementById("crearPoolLiqAddress");
    var crearPoolLiqError = document.getElementById("crearPoolLiqError");
    crearPoolLiqAddress.innerHTML = "";
    crearPoolLiqError.innerHTML = "";
    try {
      amountUsdc = ethers.parseUnits(amountUsdc, 6);
      amountBBToken = ethers.parseEther(amountBBToken);

      //pudo llamarse a mint, pero el duenio del contrato BBToken no tiene permisos de mint, ademas se pierde atomicidad de toda la transaccion
      //tx = await bbitesTknContract.connect(signer).mint(liqProviderAddress, amountBBToken);
      //no llamamos a transfer, pues se pierde la atomicidad de toda la transaccion
      //var tx = await usdcContract.connect(signer).transfer(liqProviderAddress, amountUsdc);
      
      //Por ello, liqProvider.addLiquidity hace un transferFrom del owner asi mismo, 
      //asi que liqProvider maneja los tokens del owner, por eso el owner le da approve sobre sus tokens

      var tx = await usdcContract.connect(signer).approve(liqProviderAddress, amountUsdc);
      await tx.wait();
      var tx = await bbTokenContract.connect(signer).approve(liqProviderAddress, amountBBToken);
      await tx.wait();

      var tx = await liqProviderContract.connect(signer).
        addLiquidity(
          usdcAddress,
          bbTokenAddress,
          amountUsdc,
          amountBBToken,
          amountUsdc,
          amountBBToken,
          account,
          (new Date().getTime() + 60000)
        );

      var response = await tx.wait();
      var transactionHash = response.hash;
      console.log("Tx Hash:", transactionHash);

      poolAddress = await liqProviderContract.getPair(usdcAddress, bbTokenAddress);

      crearPoolLiqAddress.innerHTML = "poolAddress: " + poolAddress;
      document.getElementById("poolAddress").innerHTML = poolAddress;

      //deshabilitar el boton, aunque puedo dejarlo, para despues aumentar el pool de liquidez
      //bttn.disabled = true;
      //mostrar la operacion de compra de nft con usdc (swapping usdc/bbtoken)
      // var divSwap = document.getElementById("divSwap");
      // divSwap.style.display = "block";

    } catch (error) {
      console.log(error);
      crearPoolLiqError.innerHTML = error.message;
    }
  });

  // Mint USDC
  var bttn = document.getElementById("mintUsdcBtn");
  bttn.addEventListener("click", async function () {
    var amount = document.getElementById("mintUsdc").value;
    var spanMintUsdc = document.getElementById("spanMintUsdc");
    var mintUsdcBtn_Error = document.getElementById("mintUsdcBtn_Error");
    spanMintUsdc.innerHTML = "";
    mintUsdcBtn_Error.innerHTML = "";
    try {
      var tx = await usdcContract.connect(signer).mint(account, ethers.parseUnits(amount, 6));
      var response = await tx.wait();
      var transactionHash = response.hash;
      spanMintUsdc.innerHTML = "Transaction Hash: " + transactionHash;
    } catch (error) {
      console.log(error);
      mintUsdcBtn_Error.innerHTML = error.message;
    }
  });

  //Swap Exact USDCoins for BBTokens
  var bttn = document.getElementById("btnSwapExactFor");
  bttn.addEventListener("click", async function () {
    var amountInUscd = document.getElementById("amountInUscd").value;
    var amountOutMinBBToken = document.getElementById("amountOutMinBBToken").value;
    var spanSwapExactFor = document.getElementById("spanSwapExactFor");
    var errorSwapExactFor = document.getElementById("errorSwapExactFor");
    spanSwapExactFor.innerHTML = "";
    errorSwapExactFor.innerHTML = "";
    try {
      amountInUscd = ethers.parseUnits(amountInUscd, 6);
      amountOutMinBBToken = ethers.parseEther(amountOutMinBBToken);

      var tx = await usdcContract.connect(signer).approve(swapperAddress, amountInUscd);
      await tx.wait();

      //si falla la tx, p.ejem. si el amountOutMinBBToken es demasiado alto para hacer el swap, se revierte todo, pero los approve no se revierten
      var tx = await swapperContract.connect(signer).
        swapExactTokensForTokens(
          amountInUscd,
          amountOutMinBBToken,
          [usdcAddress, bbTokenAddress],
          account,//el que recibe los bbtokens
          (new Date().getTime() + 60000)
        );
      var response = await tx.wait();
      var transactionHash = response.hash;
      spanSwapExactFor.innerHTML = "Transaction Hash: " + transactionHash;
    } catch (error) {
      console.log(error);
      errorSwapExactFor.innerHTML = error.message;
    }
  });

  //Swap USDCoins for Exact BBTokens
  var bttn = document.getElementById("btnSwapForExact");
  bttn.addEventListener("click", async function () {
    var amountInMaxUsdc = document.getElementById("amountInMaxUsdc").value;
    var amountOutBBToken = document.getElementById("amountOutBBToken").value;
    var spanSwapForExact = document.getElementById("spanSwapForExact");
    var errorSwapForExact = document.getElementById("errorSwapForExact");
    spanSwapForExact.innerHTML = "";
    errorSwapForExact.innerHTML = "";
    try {
      amountInMaxUsdc = ethers.parseUnits(amountInMaxUsdc, 6);
      amountOutBBToken = ethers.parseEther(amountOutBBToken);

      var tx = await usdcContract.connect(signer).approve(swapperAddress, amountInMaxUsdc);
      await tx.wait();
      //si falla la tx, p.ejem. si el amountInMaxUsdc es demasiado bajo para hacer el swap, se revierte todo, pero los approve no se revierten
      //internamente hay manejo de vuelto de Usdc, si el amountInMaxUsdc es mayor a la cantidad de Usdc para el swap
      var tx = await swapperContract.connect(signer).
        swapTokensForExactTokens(
          amountOutBBToken,
          amountInMaxUsdc,
          [usdcAddress, bbTokenAddress],
          account,//el que recibe los bbtokens
          (new Date().getTime() + 60000)
        );
      var response = await tx.wait();
      var transactionHash = response.hash;
      spanSwapForExact.innerHTML = "Transaction Hash: " + transactionHash;
    } catch (error) {
      console.log(error);
      errorSwapForExact.innerHTML = error.message;
    }
  });

  // ALLOWANCE USDC
  var bttn = document.getElementById("allowanceUsdcButton");
  bttn.addEventListener("click", async function () {
    var allowanceUsdcAmount = document.getElementById("allowanceUsdcAmount");
    var allowanceUsdcError = document.getElementById("allowanceUsdcError");
    allowanceUsdcError.innerHTML = "";
    try {
      var allowanceUsdc = await usdcContract.allowance(account, publicSaleAddress);
      allowanceUsdcAmount.innerHTML = ethers.formatUnits(allowanceUsdc, 6);
    } catch (error) {
      console.log(error);
      allowanceUsdcError.innerHTML = error.message;
    }
  });

  // ALLOWANCE BBTKN
  var bttn = document.getElementById("allowanceBBTknButton");
  bttn.addEventListener("click", async function () {
    var allowanceBBTknAmount = document.getElementById("allowanceBBTknAmount");
    var allowanceBBTknError = document.getElementById("allowanceBBTknError");
    allowanceBBTknError.innerHTML = "";
    try {
      var allowanceBBTkn = await bbTokenContract.allowance(account, publicSaleAddress);
      allowanceBBTknAmount.innerHTML = ethers.formatUnits(allowanceBBTkn, 18);
    } catch (error) {
      console.log(error);
      allowanceBBTknError.innerHTML = error.message;
    }
  });

  // APPROVE USDC
  var bttn = document.getElementById("approveButtonUSDC");
  bttn.addEventListener("click", async function () {
    var amount = document.getElementById("approveInputUSDC").value;
    var approveUsdcOk = document.getElementById("approveUsdcOk");
    var approveUsdcError = document.getElementById("approveUsdcError");
    approveUsdcOk.innerHTML = "";
    approveUsdcError.innerHTML = "";
    try {
      var tx = await usdcContract.connect(signer).approve(publicSaleAddress, ethers.parseUnits(amount, 6));
      var response = await tx.wait();
      var transactionHash = response.hash;
      approveUsdcOk.innerHTML = "Transaction Hash: " + transactionHash;
    } catch (error) {
      console.log(error);
      approveUsdcError.innerHTML = error.message;
    }
  });

  // APPROVE BBTKN
  var bttn = document.getElementById("approveButtonBBTkn");
  bttn.addEventListener("click", async function () {
    var amount = document.getElementById("approveInput").value;
    var approveBBTokenOk = document.getElementById("approveBBTokenOk");
    var approveBBTokenError = document.getElementById("approveBBTokenError");
    approveBBTokenOk.innerHTML = "";
    approveBBTokenError.innerHTML = "";
    try {
      var tx = await bbTokenContract.connect(signer).approve(publicSaleAddress, ethers.parseEther(amount));
      var response = await tx.wait();
      var transactionHash = response.hash;
      approveBBTokenOk.innerHTML = "Transaction Hash: " + transactionHash;
    } catch (error) {
      console.log(error);
      approveBBTokenError.innerHTML = error.message;
    }
  });

  // purchaseWithTokens
  var bttn = document.getElementById("purchaseButton");
  bttn.addEventListener("click", async function () {
    var nftId = document.getElementById("purchaseInput").value;
    var purchaseBBTokenOk = document.getElementById("purchaseBBTokenOk");
    var purchaseError = document.getElementById("purchaseError");
    purchaseBBTokenOk.innerHTML = "";
    purchaseError.innerHTML = "";
    try {
      var tx = await publicSaleContract.connect(signer).purchaseWithTokens(nftId);
      var response = await tx.wait();
      var transactionHash = response.hash;
      purchaseBBTokenOk.innerHTML = "Transaction Hash: " + transactionHash;
    } catch (error) {
      console.log(error);
      purchaseError.innerHTML = error.message;
    }
  });

  // Estimate USDCoins 'ForExactBBTokens' (NFT: 0 - 699)
  var bttn = document.getElementById("estimateButtonUSDC");
  bttn.addEventListener("click", async function () {
    var nftId = document.getElementById("nftIdForEstimateUsdc").value;
    var estimateErrorUSDC = document.getElementById("estimateErrorUSDC");
    var estimationUSDC = document.getElementById("estimationUSDC");
    estimateErrorUSDC.innerHTML = "";
    try {
      // si estimateUSDCoinsForExactBBTokens emite un evento con el amount, ya no es view, y requiere de firma por el gasto del gas,
      // y la funcion a pesar de tener 'return', no retorna el amount de forma directa a la web 2.0

      // var tx = await publicSaleContract.connect(signer).estimateUSDCoinsForExactBBTokens(nftId);
      // var response = await tx.wait();
      // var transactionHash = response.hash;
      // console.log("Tx Hash:", transactionHash);
      // var amount = parseInt(response.logs[0].data, 16);
      // // var amount2 = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], response.logs[0].data);
      // // console.log("estimate compare:", amount == amount2); // true

      var amount = await publicSaleContract.estimateUSDCoinsForExactBBTokens(nftId);
      amount = ethers.formatUnits(amount, 6);
      estimationUSDC.innerHTML = amount;
    } catch (error) {
      console.log(error);
      estimateErrorUSDC.innerHTML = error.message;
    }
  });

  // purchaseWithUSDC
  var bttn = document.getElementById("purchaseButtonUSDC");
  bttn.addEventListener("click", async function () {
    var nftId = document.getElementById("purchaseInputUSDC").value;
    var amountIn = document.getElementById("amountInUSDCInput").value;
    var purchaseUsdcOk = document.getElementById("purchaseUsdcOk");
    var purchaseErrorUSDC = document.getElementById("purchaseErrorUSDC");
    purchaseUsdcOk.innerHTML = "";
    purchaseErrorUSDC.innerHTML = "";
    try {
      var tx = await publicSaleContract.connect(signer).purchaseWithUSDC(nftId, ethers.parseUnits(amountIn, 6));
      var response = await tx.wait();
      var transactionHash = response.hash;
      purchaseUsdcOk.innerHTML = "Transaction Hash: " + transactionHash;
    } catch (error) {
      console.log(error);
      purchaseErrorUSDC.innerHTML = error.message;
    }
  });

  // purchaseWithEtherAndId
  var bttn = document.getElementById("purchaseButtonEtherId");
  bttn.addEventListener("click", async function () {
    var nftId = document.getElementById("purchaseInputEtherId").value;
    var purchaseEtherOk = document.getElementById("purchaseEtherOk");
    var purchaseEtherIdError = document.getElementById("purchaseEtherIdError");
    purchaseEtherOk.innerHTML = "";
    purchaseEtherIdError.innerHTML = "";
    try {
      var tx = await publicSaleContract.connect(signer).purchaseWithEtherAndId(nftId, { value: ethers.parseEther("0.1") /*.toString()*/ /*0.1 * Math.pow(10, 18)*/ });
      var response = await tx.wait();
      var transactionHash = response.hash;
      purchaseEtherOk.innerHTML = "Transaction Hash: " + transactionHash;
    } catch (error) {
      console.log(error);
      purchaseEtherIdError.innerHTML = error.message;
    }
  });

  // send Ether
  var bttn = document.getElementById("sendEtherButton");
  bttn.addEventListener("click", async function () {
    var sendEtherOk = document.getElementById("sendEtherOk");
    var sendEtherError = document.getElementById("sendEtherError");
    sendEtherOk.innerHTML = "";
    sendEtherError.innerHTML = "";
    try {
      //var tx = await pubSContract.connect(signer).depositEthForARandomNft({ value: ethers.parseEther("0.1") /*.toString()*/});
      var tx = await signer.sendTransaction({ to: publicSaleAddress, value: ethers.parseEther("0.1") });//cae en el metodo receive()
      var response = await tx.wait();
      var transactionHash = response.hash;
      sendEtherOk.innerHTML = "Transaction Hash: " + transactionHash;
    } catch (error) {
      console.log(error);
      sendEtherError.innerHTML = error.message;
    }
  });

  // getPriceForId
  // getPriceForAnyNftId
  var bttn = document.getElementById("priceForAnyNftIdBttn");
  bttn.addEventListener("click", async function () {
    var nftId = document.getElementById("priceForAnyNftIdInput").value;
    var priceForAnyNftIdText = document.getElementById("priceForAnyNftIdText");
    var priceForAnyNftIdError = document.getElementById("priceForAnyNftIdError");
	  priceForAnyNftIdText.innerHTML = "";
    priceForAnyNftIdError.innerHTML = "";
    try {
      //debugger;
      var price = await publicSaleContract.getPriceForId(nftId);
      priceForAnyNftIdText.innerHTML = ethers.formatEther(price); // price;
	  
      // debugger;
      // var tx = await publicSaleContract.connect(signer).getPriceForAnyNftId(nftId);
      // console.log(tx);
      // var response = await tx.wait();
      // console.log(response);

      // //debugger;
      // var tx = await publicSaleContract.connect(signer).getPriceForAnyNftId(nftId);
      // var response = await tx.wait();
      // //var event = response.events.find(event => event.event === 'priceForAnyNftId');
      // var transactionHash = response.hash;
      // console.log("Tx Hash:", transactionHash);
      // var msgPrice = ethers.AbiCoder.defaultAbiCoder().decode(["string"], response.logs[0].data);
      // var msgPrice2 = ethers.toUtf8String(response.logs[0].data);
      // console.log("msgPrice", msgPrice);
      // console.log("msgPrice2", msgPrice2);
      // if(msgPrice[0].split(" ").length > 1 && !isNaN(msgPrice[0].split(" ")[0])){
      //   var price = ethers.parseUnits(msgPrice[0].split(" ")[0], 0);
      //   msgPrice = ethers.formatEther(price) + " " + msgPrice[0].split(" ")[1];
      // }
      // priceForAnyNftIdText.innerHTML = msgPrice;

    } catch (error) {
      console.log(error);
      priceForAnyNftIdError.innerHTML = error.message;
    }
  });

  // Withdraw Ethers del contrato PublicSale - balanceOf
  var bttn = document.getElementById("withdrawEtherBtn");
  bttn.addEventListener("click", async function () {
    var withdrawEther_Ok = document.getElementById("withdrawEther_Ok");
    var withdrawEther_Error = document.getElementById("withdrawEther_Error");
    withdrawEther_Ok.innerHTML = "";
    withdrawEther_Error.innerHTML = "";
    try {
      var tx = await publicSaleContract.connect(signer).withdrawEther();
      var response = await tx.wait();
      var transactionHash = response.hash;
      withdrawEther_Ok.innerHTML = "Transaction Hash: " + transactionHash;
    } catch (error) {
      console.log(error);
      withdrawEther_Error.innerHTML = error.message;
    }
  });

  // Withdraw BBTokens del contrato PublicSale - balanceOf
  var bttn = document.getElementById("withdrawBBTokenBtn");
  bttn.addEventListener("click", async function () {
    var withdrawBBToken_Ok = document.getElementById("withdrawBBToken_Ok");
    var withdrawBBToken_Error = document.getElementById("withdrawBBToken_Error");
    withdrawBBToken_Ok.innerHTML = "";
    withdrawBBToken_Error.innerHTML = "";
    try {
      var tx = await publicSaleContract.connect(signer).withdrawTokens();
      var response = await tx.wait();
      var transactionHash = response.hash;
      withdrawBBToken_Ok.innerHTML = "Transaction Hash: " + transactionHash;
    } catch (error) {
      console.log(error);
      withdrawBBToken_Error.innerHTML = error.message;
    }
  });

  // generar firma digital y enviarlo al autotask
  var bttn = document.getElementById("sendFirmaDigital");
  bttn.addEventListener("click", async function () {
    var bbTokenAddressInput = document.getElementById("bbTokenAddressInput").value;
    var publicSaleAddressInput = document.getElementById("publicSaleAddressInput").value;
    var amountBBTokensToPermit = document.getElementById("amountBBTokensToPermit").value;
    var firmaDigitalOk = document.getElementById("firmaDigitalOk");
    var firmaDigitalError = document.getElementById("firmaDigitalError");
    firmaDigitalOk.innerHTML = "";
    firmaDigitalError.innerHTML = "";
    try {
      const abi = [
        "function nonces(address account) public view returns(uint256)",
        "function name() public view returns(string memory)",
      ];
      //debugger;
      let goerliProvider = new ethers.JsonRpcProvider(config.urls.rpcUrl_Goerli);
      //el comprador no gastara gas, por ende al generar la firma digital, usara el goerliProvider que solo es para llamar a funciones de solo lectura de los contratos
      const tokenContract = new Contract(bbTokenAddressInput, abi, /*provider*/ goerliProvider);
      const tokenName = await tokenContract.name();
      const nonce = await tokenContract.nonces(signer.address);
      const amount = ethers.parseEther(amountBBTokensToPermit).toString();
      const deadline = Math.round(Date.now() / 1000) + 60 * 10; // 10 min

      const [domain, types, values] = buildMessageData(
        tokenName,
        bbTokenAddressInput,//Address del token que implementa ERC20Permit
        signer.address,//ownerAddress
        publicSaleAddressInput,//spenderAddress
        amount,
        nonce.toString(),
        deadline
      );

      var sigData = await signer.signTypedData(domain, types, values);
      // Se separa la firma en sus componentes v, r y s
      var splitSignature = ethers.Signature.from(sigData);
      var { v, r, s } = splitSignature;

      console.log("ownerAddress:", signer.address);
      console.log("spenderAddress:", publicSaleAddressInput);
      console.log("value:", amount);
      console.log("deadline:", deadline);
      console.log("v:", v);
      console.log("r:", r);
      console.log("s:", s);

      var data = {
        "ownerAddress" : signer.address,
        "spenderAddress" : publicSaleAddressInput,
        "value" : amount,
        "deadline" : deadline,
        "v" : v,
        "r" : r,
        "s" : s,
      };

      var url = config.urls.WebhookURI_FirmaDigital;

      const response = await fetch(url, {
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        mode: "cors", // no-cors, *cors, same-origin
        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
        credentials: "same-origin", // include, *same-origin, omit
        headers: {
          "Content-Type": "application/json",
          // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: "follow", // manual, *follow, error
        referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body: JSON.stringify(data), // body data type must match "Content-Type" header
      });

      //console.log("response:", await response.json());
       
      firmaDigitalOk.innerHTML = JSON.stringify(await response.json(), null, 2);
      //console.log( JSON.stringify(await response.json(), null, 2));
      //console.log(await response.json());
      //console.log(await response.json());
    } catch (error) {
      console.log(error);
      firmaDigitalError.innerHTML = error.message;
    }
  });

  // Obtener dueño de NFT si existe el NFT
  var bttn = document.getElementById("getNftOwner");
  bttn.addEventListener("click", async () => {
    var ntfId = document.getElementById("ntfId").value;
    var nftOwner = document.getElementById("nftOwner");
    var nftOwnerError = document.getElementById("nftOwnerError");
    nftOwner.innerHTML = "";
    nftOwnerError.innerHTML = "";
    try {
      var owner = await nftContract.connect(signer).ownerOf(ntfId);
      nftOwner.innerHTML = owner;
    } catch (error) {
      console.log(error);
      nftOwnerError.innerHTML = error.message;
    }
  });

  // getProofs
  var bttn = document.getElementById("getProofsButtonId");
  bttn.addEventListener("click", async () => {
    var id = document.getElementById("inputIdProofId").value;
    var address = document.getElementById("inputAccountProofId").value;
    var showProofsTextId = document.getElementById("showProofsTextId");

    var proofs = merkleTree.getHexProof(hashToken(id, address));

    showProofsTextId.innerHTML = JSON.stringify(proofs);
    await navigator.clipboard.writeText(JSON.stringify(proofs));
  });

  // safeMintWhiteList
  var bttn = document.getElementById("safeMintWhiteListBttnId");
  bttn.addEventListener("click", async function () {
    var to = document.getElementById("whiteListToInputId").value;
    var tokenId = document.getElementById("whiteListToInputTokenId").value;
    //usar ethers.hexlify porque es un array de bytes
    var proofs = document.getElementById("whiteListToInputProofsId").value;
    proofs = JSON.parse(proofs).map(ethers.hexlify);
    var whiteListMintOk = document.getElementById("whiteListMintOk");
    var whiteListMintError = document.getElementById("whiteListMintError");
    whiteListMintOk.innerHTML = "";
    whiteListMintError.innerHTML = "";
    try {
      var tx = await nftContract.connect(signer).safeMintWhiteList(to, tokenId, proofs);
      var response = await tx.wait();
      var transactionHash = response.hash;
      whiteListMintOk.innerHTML = "Transaction Hash: " + transactionHash;
    } catch (error) {
      console.log(error);
      whiteListMintError.innerHTML = error.message;
    }
  });

  // buyBack
  var bttn = document.getElementById("buyBackBttn");
  bttn.addEventListener("click", async function () {
    var id = document.getElementById("buyBackInputId").value;
    var buyBackOk = document.getElementById("buyBackOk");
    var buyBackError = document.getElementById("buyBackError");
    buyBackOk.innerHTML = "";
    buyBackError.innerHTML = "";
    try {
      var tx = await nftContract.connect(signer).buyBack(id);
      var response = await tx.wait();
      var transactionHash = response.hash;
      buyBackOk.innerHTML = "Transaction Hash: " + transactionHash;
    } catch (error) {
      console.log(error);
      buyBackError.innerHTML = error.message;
    }
  });

}

async function setUpEventsContracts() {

  if (window.ethereum.networkVersion == "5") {//GOERLI
    //var providerMumbai = new ethers.JsonRpcProvider("https://", )
    //var wallet = new ethers.Wallet(privateKey, ethers.provider);

    var usdcList = document.getElementById("usdcList");
    usdcContract.on("Transfer", (from, to, value) => {
      value = ethers.formatUnits(value, 6);
      console.log("[usdcContract - Transfer] from: " + from + " - to: " + to + " - amount: " + value);
      usdcList.innerHTML = usdcList.innerHTML + "<br>[usdcContract - Transfer] from: " + from + " - to: " + to + " - amount: " + value;
    });

    var bbitesTList = document.getElementById("bbitesTList");
    bbTokenContract.on("Transfer", (from, to, value) => {
      value = ethers.formatEther(value);
      console.log("[bbTokenContract - Transfer] from: " + from + " - to: " + to + " - amount: " + value);
      bbitesTList.innerHTML = bbitesTList.innerHTML + "<br>[bbTokenContract - Transfer] from: " + from + " - to: " + to + " - amount: " + value;
    });

    var pubSList = document.getElementById("pubSList");
    publicSaleContract.on("PurchaseNftWithId", (account, id) => {
      console.log("[publicSaleContract - PurchaseNftWithId] account: " + account + " - NFT Id: " + id);
      pubSList.innerHTML = pubSList.innerHTML + "<br>[publicSaleContract - PurchaseNftWithId] account: " + account + " - NFT Id: " + id;
    });

    let mumbaiProvider = new ethers.JsonRpcProvider(config.urls.rpcUrl_Mumbai);//Solo para uso de escucha de eventos o llamdas a funciones de solo lectura
    nftContract = new Contract(config.addresses.nftAddress, nftJson.abi, mumbaiProvider);
    
    var nftList = document.getElementById("nftList");
    nftContract.on("Transfer", (from, to, tokenId) => {
      console.log("[nftContract - Transfer] from: " + from + " - to: " + to + " - NFT Id: " + tokenId);
      nftList.innerHTML = nftList.innerHTML + "<br>[nftContract - Transfer] from: " + from + " - to: " + to + " - NFT Id: " + tokenId;
    });

    console.log("Asignados Event Handlres para la red GOERLI y eventos de MUMBAI");
  }
  else if (window.ethereum.networkVersion == "80001") {//MUMBAI

    // nftContract.on("*", (event) => { 
    //   console.log(event.eventName, event.args, event.log); 
    // })

    var nftList = document.getElementById("nftList");
    nftContract.on("Transfer", (from, to, tokenId) => {
      console.log("[nftContract - Transfer] from: " + from + " - to: " + to + " - NFT Id: " + tokenId);
      nftList.innerHTML = nftList.innerHTML + "<br>[nftContract - Transfer] from: " + from + " - to: " + to + " - NFT Id: " + tokenId;
    });

    var burnList = document.getElementById("burnList");
    nftContract.on("Burn", (account, id) => {
      console.log("[nftContract - Burn] account: " + account + " - NFT Id: " + id);
      burnList.innerHTML = burnList.innerHTML + "<br>[nftContract - Burn] account: " + account + " - NFT Id: " + id;
    });

    let goerliProvider = new ethers.JsonRpcProvider(config.urls.rpcUrl_Goerli);//Solo para uso de escucha de eventos o llamdas a funciones de solo lectura
    bbTokenContract = new Contract(config.addresses.bbTokenAddress, bbTokenJson.abi, goerliProvider);
    publicSaleContract = new Contract(config.addresses.publicSaleAddress, publicSaleJson.abi, goerliProvider);

    var bbitesTList = document.getElementById("bbitesTList");
    bbTokenContract.on("Transfer", (from, to, value) => {
      value = ethers.formatEther(value);
      console.log("[bbTokenContract - Transfer] from: " + from + " - to: " + to + " - amount: " + value);
      bbitesTList.innerHTML = bbitesTList.innerHTML + "<br>[bbTokenContract - Transfer] from: " + from + " - to: " + to + " - amount: " + value;
    });
    
    var pubSList = document.getElementById("pubSList");
    publicSaleContract.on("PurchaseNftWithId", (account, id) => {
      console.log("[publicSaleContract - PurchaseNftWithId] account: " + account + " - NFT Id: " + id);
      pubSList.innerHTML = pubSList.innerHTML + "<br>[publicSaleContract - PurchaseNftWithId] account: " + account + " - NFT Id: " + id;
    });

    console.log("Asignados Event Handlres para la red MUMBAI y eventos de GOERLI");
  }

}

async function setUp() {

  if (!window.ethereum) {
    alert("Instale la extension Metamask y refresque la pagina");
    return;
  }
  window.ethereum.on('networkChanged', function(networkId){
    console.log('networkChanged',networkId);
  });

  window.ethereum.on("chainChanged", (chainId) => {
    console.log("network: " + chainId);
    window.location.reload();
  });



  //debugger;

  // obtiene la cuenta o billetera metamask que este conectada con la pagina (http://localhost:8080)
  // si hay mas de 1 cuenta conectada con la pagina, obtiene en el orden como aparecen las cuentas en metamask conectados a la pagina, y lo setea en el array
  // solo abre el popup de metamask cuando:
  // - si no se ha iniciado sesion con metamask
  // - si no hay ninguna cuenta conectado con la pagina web
  // si se cancela el popup para conectar a alguna cuenta de metamask, se lanza un error, deberia estar envuelto en un try-catch
  var cuentaAux, cuentaAux2;
  [account, cuentaAux, cuentaAux2] = await ethereum.request({
    method: "eth_requestAccounts",
  });

  console.log("Billetera metamask", account);

  // lo siguiente es para obtener el Signer de la cuenta de metamask, usando el provider de metamask. esto servirá para la firma de TXs
  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner(account);

  var redId = document.getElementById("redId");
  var walletId = document.getElementById("walletId");
  walletId.innerHTML = account;

  if (window.ethereum.networkVersion == "5") {//goerli
    redId.innerHTML = "GOERLI";

    initSCsGoerli();
    
    poolAddress = await liqProviderContract.getPair(usdcAddress, bbTokenAddress);
    console.log("poolAddress: " + poolAddress);
    if (poolAddress === "0x0000000000000000000000000000000000000000") {
      //ocultar la operacion de compra de nft con usdc (swapping usdc/bbtoken)
      // var divSwap = document.getElementById("divSwap");
      // divSwap.style.display = "none";
    }
  
    document.getElementById("walletAddress").innerHTML = signer.address;
    document.getElementById("usdcAddress").innerHTML = usdcAddress;
    document.getElementById("bbTokenAddress").innerHTML = bbTokenAddress;
    document.getElementById("publicSaleAddress").innerHTML = publicSaleAddress;
    document.getElementById("liqProviderAddress").innerHTML = liqProviderAddress;
    document.getElementById("swapperAddress").innerHTML = swapperAddress;
    document.getElementById("poolAddress").innerHTML = poolAddress=='0x0000000000000000000000000000000000000000' ? "No existe aun pool de liquidez" : poolAddress;

    document.getElementById("bbTokenAddressInput").value = bbTokenAddress;
    document.getElementById("publicSaleAddressInput").value = publicSaleAddress;
    
  }
  else if (window.ethereum.networkVersion == "80001") {//mumbai
    redId.innerHTML = "MUMBAI";
    buildMerkleTree();
    initSCsMumbai();

    document.getElementById("nftAddress").innerHTML = nftAddress;
  }

  setUpListeners();

  setUpEventsContracts();

}

setUp()
  .then()
  .catch((e) => {
    alert("Error interno, refresque la pagina e intente nuevamente");
    console.log(e)
  });
