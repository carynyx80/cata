// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ICataConfig} from "../../../src/interfaces/ICataConfig.sol";
import {ICataPriceIndex} from "../../../src/interfaces/ICataPriceIndex.sol";
import {Card} from "../../../src/interfaces/ICataVault.sol";
import {IAggregatorV3} from "../../../src/markets/IAggregatorV3.sol";

contract MockConfig is ICataConfig {
    address public owner;
    address public treasury;
    address public companyWallet;
    address public usdt;
    address public cataToken;
    uint16 public feeBps = 20;
    bool public paused;
    mapping(bytes32 => bool) public featureEnabled;
    mapping(address => bool) public isOracle;
    mapping(address => bool) public isOperator;

    constructor(address owner_, address treasury_, address company_, address usdt_) {
        owner = owner_;
        treasury = treasury_;
        companyWallet = company_;
        usdt = usdt_;
    }

    function cataActive() external view returns (bool) { return cataToken != address(0); }
    function activateCata(address t) external { require(cataToken == address(0)); cataToken = t; }
    function setFeature(bytes32 f, bool on) external { featureEnabled[f] = on; }
    function setOracle(address a, bool on) external { isOracle[a] = on; }
    function setOperator(address a, bool on) external { isOperator[a] = on; }
    function setPaused(bool p) external { paused = p; }
}

contract MockERC20 is ERC20 {
    uint8 private immutable _dec;
    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) { _dec = d; }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amt) external { _mint(to, amt); }
}

contract MockPriceIndex is ICataPriceIndex {
    mapping(bytes32 => uint256) public price;
    mapping(bytes32 => uint64) public updated;

    function priceUsd(bytes32 id) external view returns (uint256, uint64) { return (price[id], updated[id]); }

    function setPrices(bytes32[] calldata ids, uint256[] calldata p) external {
        for (uint256 i = 0; i < ids.length; i++) { price[ids[i]] = p[i]; updated[ids[i]] = uint64(block.timestamp); }
    }

    function set(bytes32 id, uint256 p) external { price[id] = p; updated[id] = uint64(block.timestamp); }
}

contract MockAggregator is IAggregatorV3 {
    int256 public answer;
    uint256 public updatedAt;
    constructor(int256 a) { answer = a; updatedAt = block.timestamp; }
    function decimals() external pure returns (uint8) { return 8; }
    function set(int256 a) external { answer = a; updatedAt = block.timestamp; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

/// @notice Minimal vault exposing the ICataVault functions the market contracts use.
contract MockVault is ERC721 {
    uint256 public nextId = 1;
    mapping(uint256 => Card) internal _cards;

    constructor() ERC721("Mock Vault", "MV") {}

    function mint(address to, Card calldata c) external returns (uint256 id) {
        id = nextId++;
        _cards[id] = c;
        _mint(to, id);
    }

    function cardOf(uint256 id) external view returns (Card memory) { return _cards[id]; }
    function catalogIdOf(uint256 id) external view returns (bytes32) { return _cards[id].catalogId; }
    function burnForRedeem(uint256 id) external { require(ownerOf(id) == msg.sender); _burn(id); }
}
