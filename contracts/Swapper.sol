// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Interfaces.sol";

contract Swapper {

    IUniswapV2Router02 router = IUniswapV2Router02(routerAddress);

    event SwapAmounts(uint[] amounts);

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts){

        address origenToken = path[0];

        IERC20(origenToken).transferFrom(msg.sender, address(this), amountIn);

        IERC20(origenToken).approve(routerAddress, amountIn);

        amounts = router.swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline);
        
        emit SwapAmounts(amounts);
    }
    
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts){

        address origenToken = path[0];

        IERC20(origenToken).transferFrom(msg.sender, address(this), amountInMax);

        IERC20(origenToken).approve(routerAddress, amountInMax);

        amounts = router.swapTokensForExactTokens(amountOut, amountInMax, path, to, deadline);

        uint256 diff = amountInMax - amounts[0];
        if(diff > 0){
            IERC20(origenToken).transfer(msg.sender, diff);
        }
        
        emit SwapAmounts(amounts);
    }
}