const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { ethers } = require("hardhat");
const walletAndIds = require("../wallets/walletList");

function hashToken(tokenId, account) {
  return Buffer.from(
    ethers
      .solidityPackedKeccak256(["uint256", "address"], [tokenId, account])
      .slice(2),
    "hex"
  );
}

var merkleTree, root;
function buildMerkleTree() {
  var elementosHasheados = walletAndIds.map(({ id, address }) => {
    return hashToken(id, address);
  });
  merkleTree = new MerkleTree(elementosHasheados, ethers.keccak256, {
    sortPairs: true,
  });

  root = merkleTree.getHexRoot();

  //console.log(" merkleTree.getHexRoot(): " + root);
  return merkleTree;
}

function getRootFromMT() {
  buildMerkleTree();
  return root;
}

function getProofs(id, address){
  var proofs = buildMerkleTree().getHexProof(hashToken(id, address));
  proofs = JSON.stringify(proofs);
  proofs = JSON.parse(proofs).map(ethers.hexlify);
  return proofs;
}

module.exports = { getRootFromMT, getProofs, walletAndIds};
