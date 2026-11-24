// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

struct Card {
    bytes32 catalogId;
    uint8 grade;
    bytes16 grader;
    string cert;
    bool physical;
}

interface ICataVault is IERC721 {
    function cardOf(uint256 tokenId) external view returns (Card memory);
    function catalogIdOf(uint256 tokenId) external view returns (bytes32);
    function mint(address to, Card calldata card) external returns (uint256 tokenId); // operator only
    function burnForRedeem(uint256 tokenId) external; // owner of token, emits RedeemRequested(tokenId, owner, cert)
}
