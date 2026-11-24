// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Minimal per-grail share token. Only the FractionalGrails contract can mint/burn.
contract GrailShares is ERC20 {
    address public immutable manager;

    error OnlyManager();

    constructor(string memory name_, string memory symbol_, uint256 supply) ERC20(name_, symbol_) {
        manager = msg.sender;
        _mint(msg.sender, supply);
    }

    function burnFrom(address from, uint256 amount) external {
        if (msg.sender != manager) revert OnlyManager();
        _burn(from, amount);
    }
}
