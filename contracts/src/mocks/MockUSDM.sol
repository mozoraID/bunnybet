// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Minimal USDM mock for Foundry tests.
contract MockUSDM is ERC20 {
    constructor() ERC20("USD Megacoin", "USDM") {}

    /// @dev Mint freely — tests only.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
