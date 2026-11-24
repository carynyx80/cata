// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICataConfig {
    function owner() external view returns (address);
    function treasury() external view returns (address);
    function companyWallet() external view returns (address);
    function usdt() external view returns (address);
    function cataToken() external view returns (address); // address(0) until activated
    function cataActive() external view returns (bool);
    function feeBps() external view returns (uint16); // 20
    function paused() external view returns (bool);
    function featureEnabled(bytes32 feature) external view returns (bool);
    function isOracle(address account) external view returns (bool);
    function isOperator(address account) external view returns (bool);
}
