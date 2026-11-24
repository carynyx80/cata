// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {VRFV2PlusClient} from "../vendor/VRFV2Plus.sol";

contract MockERC20 is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }
}

interface IVRFConsumer {
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
}

contract MockVRFCoordinator {
    uint256 public nextId = 1;
    mapping(uint256 => address) public consumerOf;
    VRFV2PlusClient.RandomWordsRequest public lastRequest;

    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata req) external returns (uint256 id) {
        id = nextId++;
        consumerOf[id] = msg.sender;
        lastRequest = req;
    }

    function fulfill(uint256 id, uint256 word) external {
        uint256[] memory w = new uint256[](1);
        w[0] = word;
        IVRFConsumer(consumerOf[id]).rawFulfillRandomWords(id, w);
    }
}

contract MockAggregator {
    int256 public answer;
    uint8 public decimals = 8;
    uint256 public updatedAt;

    constructor(int256 a) {
        answer = a;
        updatedAt = block.timestamp;
    }

    function set(int256 a) external {
        answer = a;
        updatedAt = block.timestamp;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

/// @dev Pays out a fixed `rate` of CATA (pre-minted to the router) per unit of input, path end = CATA.
contract MockRouter {
    address public immutable WETH;
    uint256 public rate = 1000; // 1 input wei => 1000 CATA wei

    constructor(address weth) {
        WETH = weth;
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external payable {
        require(path[0] == WETH, "path");
        uint256 out = msg.value * rate;
        require(out >= amountOutMin, "slippage");
        IERC20(path[path.length - 1]).transfer(to, out);
    }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external {
        require(path.length == 3 && path[1] == WETH, "path");
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        uint256 out = amountIn * rate;
        require(out >= amountOutMin, "slippage");
        IERC20(path[2]).transfer(to, out);
    }
}
