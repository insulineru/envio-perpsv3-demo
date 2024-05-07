import { PerpsV3MarketProxyContract_AccountCreated_handler, PerpsV3MarketProxyContract_AccountCreated_loader, PerpsV3MarketProxyContract_MarketCreated_handler, PerpsV3MarketProxyContract_MarketCreated_loader, PerpsV3MarketProxyContract_OrderCommitted_handler, PerpsV3MarketProxyContract_OrderSettled_handlerAsync, PerpsV3MarketProxyContract_OrderSettled_loader, PerpsV3MarketProxyContract_PermissionGranted_handler, PerpsV3MarketProxyContract_PermissionGranted_loader, PerpsV3MarketProxyContract_PermissionRevoked_handler, PerpsV3MarketProxyContract_PermissionRevoked_loader, PerpsV3MarketProxyContract_PositionLiquidated_handler, PerpsV3MarketProxyContract_PositionLiquidated_loader } from "../generated/src/Handlers.gen";
import { PerpsV3MarketProxyContract_OrderCommittedEvent_perpsV3AggregateStatEntityHandlerContextAsync, perpsV3AggregateStatEntity } from "../generated/src/Types.gen";
import { ETHER, getAbs } from "./helpers/bigint";

PerpsV3MarketProxyContract_MarketCreated_loader(({ event, context }) => {
  context.PerpsV3Market.load(event.params.perpsMarketId.toString())
})

PerpsV3MarketProxyContract_MarketCreated_handler(({ event, context }) => {
  context.PerpsV3Market.set({
    id: event.params.perpsMarketId.toString(),
    lastPrice: BigInt(0),
    marketSymbol: event.params.marketSymbol,
    marketName: event.params.marketName,
    interestRate: undefined,
  })
})


PerpsV3MarketProxyContract_AccountCreated_loader(({ event, context }) => {
  context.Account.load(event.params.accountId.toString())
})

PerpsV3MarketProxyContract_AccountCreated_handler(({ event, context }) => {
  const id = event.params.accountId.toString()
  const account = context.Account.get(id)

  if (!account) {
    context.Account.set({
      id,
      owner: event.params.owner,
      created_at: BigInt(event.blockTimestamp),
      created_at_block: BigInt(event.blockNumber),
      updated_at: BigInt(event.blockTimestamp),
      updated_at_block: BigInt(event.blockNumber),
      feesPaid: BigInt(0),
      liquidations: BigInt(0),
      pnl: BigInt(0),
      pnlWithFeesPaid: BigInt(0),
      totalTrades: BigInt(0),
      totalVolume: BigInt(0),
    })
  }
})

PerpsV3MarketProxyContract_PositionLiquidated_loader(({ event, context }) => {
  const { marketId, accountId } = event.params
  const positionId = `${marketId.toString()}-${accountId.toString()}`;

  context.PerpsV3Market.load(marketId.toString())
  context.OpenPerpsV3Position.load(positionId, { loadPosition: { loadAccount: true } });
  context.Account.load(accountId.toString())
})

PerpsV3MarketProxyContract_PositionLiquidated_handler(({ event, context }) => {
  const { marketId, accountId, amountLiquidated } = event.params
  const marketIdStr = marketId.toString();
  const accountIdStr = accountId.toString();

  const positionId = `${marketIdStr}-${accountIdStr}`;
  const openPosition = context.OpenPerpsV3Position.get(positionId);

  const account = context.Account.get(accountIdStr);
  const market = context.PerpsV3Market.get(marketIdStr);

  if (!market) {
    throw new Error(`Market ${marketIdStr} not found`);
  }

  if (!account) {
    throw new Error(`Account ${accountIdStr} not found`);
  }

  const estNotionalSize = getAbs(getAbs(amountLiquidated) * market.lastPrice / ETHER)

  const liquidationId = `${positionId}-${event.blockTimestamp.toString()}`;
  context.PositionLiquidation.set({
    id: liquidationId,
    marketId: marketId,
    accountId: accountId,
    accountOwner: account.owner,
    amount: amountLiquidated,
    notionalAmount: estNotionalSize,
    estimatedPrice: market.lastPrice,
    timestamp: BigInt(event.blockTimestamp),
    position_id: positionId,
  })

  if (!openPosition) {
    console.warn(`Open position ${positionId} not found`);
    return;
  } else if (openPosition.position_id) {
    const position = context.PerpsV3Position.get(openPosition.position_id);
    if (position) {
      context.PerpsV3Position.set({
        ...position,
        isLiquidated: true,
        liquidation_id: liquidationId,
        isOpen: false,
      })

      context.OpenPerpsV3Position.set({
        ...openPosition,
        position_id: undefined,
      })

      context.Account.set({
        ...account,
        liquidations: account.liquidations + BigInt(1),
      })
    }
  }
})

PerpsV3MarketProxyContract_PermissionGranted_loader(({ event, context }) => {
  context.AccountPermissionUsers.load(`${event.params.accountId.toString()}-${event.params.user}`, { loadAccount: true })
  context.Account.load(event.params.accountId.toString())
})

PerpsV3MarketProxyContract_PermissionGranted_handler(({ event, context }) => {
  const { blockNumber, blockTimestamp, params } = event;
  const { accountId, user, permission } = params;
  const account = context.Account.get(accountId.toString());

  const permissionId = `${accountId.toString()}-${user}`;
  const permissionUser = context.AccountPermissionUsers.get(permissionId);

  if (!account) {
    console.warn(`Account ${accountId} not found`)
    return
  }

  if (permissionUser) {
    context.AccountPermissionUsers.set({
      ...permissionUser,
      permissions: [...permissionUser.permissions, permission],
      updated_at: BigInt(blockTimestamp),
      updated_at_block: BigInt(blockNumber),
    })
  } else {
    context.AccountPermissionUsers.set({
      id: permissionId,
      account_id: accountId.toString(),
      address: user,
      created_at: BigInt(blockTimestamp),
      created_at_block: BigInt(blockNumber),
      updated_at: BigInt(blockTimestamp),
      updated_at_block: BigInt(blockNumber),
      permissions: [params.permission],
    })
  }
})

PerpsV3MarketProxyContract_PermissionRevoked_loader(({ event, context }) => {
  context.AccountPermissionUsers.load(`${event.params.accountId.toString()}-${event.params.user}`, { loadAccount: true })
  context.Account.load(event.params.accountId.toString())
})

PerpsV3MarketProxyContract_PermissionRevoked_handler(({ event, context }) => {
  const { blockNumber, blockTimestamp, params } = event;
  const { accountId, user, permission } = params;
  const account = context.Account.get(accountId.toString());

  const permissionId = `${accountId.toString()}-${user}`;
  const permissionUser = context.AccountPermissionUsers.get(permissionId);

  if (!account) {
    console.warn(`Account ${accountId} not found`)
    return
  }

  if (permissionUser) {
    const permissions = permissionUser.permissions.filter(p => p !== permission);
    context.AccountPermissionUsers.set({
      ...permissionUser,
      permissions,
      updated_at: BigInt(blockTimestamp),
      updated_at_block: BigInt(blockNumber),
    })
  }
})

PerpsV3MarketProxyContract_OrderSettled_loader(({ event, context }) => {
  const openPositionId = `${event.params.marketId.toString()}-${event.params.accountId.toString()}`;

  context.InterestCharged.load(`${event.params.accountId.toString()}-${event.transactionHash}`)
  context.OpenPerpsV3Position.load(openPositionId, { loadPosition: { loadAccount: true, loadLiquidation: { loadPosition: undefined } } })
  context.PerpsV3Market.load(event.params.marketId.toString())
  context.PendingOrder.load(`${event.params.accountId.toString()}-${event.params.marketId.toString()}`)
  context.Account.load(event.params.accountId.toString())
  context.OrderSettled.load(`${event.params.accountId.toString()}-${event.blockTimestamp.toString()}`, { loadAccount: true, loadPosition: { loadAccount: undefined, loadLiquidation: undefined } })

  context.PerpsV3AggregateStat.load(`${event.params.marketId.toString()}-${event.blockTimestamp.toString()}-ALL`)
})

PerpsV3MarketProxyContract_OrderSettled_handlerAsync(async ({ event, context }) => {
  const pendingOrderId = `${event.params.accountId.toString()}-${event.params.marketId.toString()}`;
  const orderId = `${event.params.accountId.toString()}-${event.blockTimestamp.toString()}`;

  const pendingOrder = await context.PendingOrder.get(pendingOrderId);
  const account = await context.Account.get(event.params.accountId.toString())

  if (!account) {
    console.warn(`Account ${event.params.accountId} not found`)
    return
  }

  const openPositionId = `${event.params.marketId.toString()}-${event.params.accountId.toString()}`;
  const openPosition = await context.OpenPerpsV3Position.get(openPositionId)

  const interestCharged = await context.InterestCharged.get(`${event.params.accountId.toString()}-${event.transactionHash}`)

  context.OrderSettled.set({
    id: orderId,
    accountId: event.params.accountId,
    account_id: event.params.accountId.toString(),
    txnHash: event.transactionHash,
    accruedFunding: event.params.accruedFunding,
    collectedFees: event.params.collectedFees,
    fillPrice: event.params.fillPrice,
    marketId: event.params.marketId,
    timestamp: BigInt(event.blockTimestamp),
    totalFees: event.params.totalFees,
    trackingCode: event.params.trackingCode,
    settlementReward: event.params.settlementReward,
    sizeDelta: event.params.sizeDelta,
    newSize: event.params.newSize,
    referralFees: event.params.referralFees,
    settler: event.params.settler,
    pnl: BigInt(0),
    orderCommitted_id: pendingOrder?.orderCommittedId,
    interestCharged: interestCharged?.interest,
    position_id: openPosition?.position_id
  })

  const volume = getAbs(getAbs(event.params.sizeDelta) * event.params.fillPrice / ETHER)

  if (!openPosition?.position_id) {
    const marketEntity = await context.PerpsV3Market.get(event.params.marketId.toString())

    if (!marketEntity) {
      console.warn(`Market ${event.params.marketId} not found`)
      return
    }

    context.PerpsV3Position.set({
      id: `${openPositionId}-${event.blockTimestamp.toString()}`,
      marketId: event.params.marketId,
      marketSymbol: marketEntity.marketSymbol,
      accountId: event.params.accountId,
      account_id: event.params.accountId.toString(),
      isLiquidated: false,
      isOpen: true,
      size: event.params.sizeDelta,
      timestamp: BigInt(event.blockTimestamp),
      openTimestamp: BigInt(event.blockTimestamp),
      avgEntryPrice: event.params.fillPrice,
      totalTrades: BigInt(1),
      entryPrice: event.params.fillPrice,
      lastPrice: event.params.fillPrice,
      realizedPnl: BigInt(0),
      feesPaid: event.params.totalFees,
      netFunding: event.params.accruedFunding,
      pnlWithFeesPaid: BigInt(0),
      totalVolume: volume,
      totalReducedNotional: BigInt(0),
      closeTimestamp: undefined,
      exitPrice: undefined,
      liquidation_id: undefined,
    })

    context.OpenPerpsV3Position.set({
      id: openPositionId,
      position_id: `${openPositionId}-${event.blockTimestamp.toString()}`,
    })

    await updateAggregateStatEntities(context.PerpsV3AggregateStat, event.params.marketId, marketEntity.marketSymbol, BigInt(event.blockTimestamp), BigInt(1), volume)

    context.Account.set({
      ...account,
      feesPaid: account.feesPaid + event.params.totalFees,
      totalTrades: account.totalTrades + BigInt(1),
      totalVolume: account.totalVolume + volume,
    })
  } else {
    const notionalValue = getAbs(event.params.sizeDelta) * event.params.fillPrice

    const position = await context.PerpsV3Position.get(openPosition.position_id)

    if (!position) {
      console.warn(`Position ${openPosition.position_id} not found`)
      return
    }

    const modifiedPosition = {
      ...position,
      feesPaid: position.feesPaid + event.params.totalFees,
      netFunding: position.netFunding + event.params.accruedFunding,
      size: position.size + event.params.sizeDelta,
    }

    await updateAggregateStatEntities(context.PerpsV3AggregateStat, position.marketId, position.marketSymbol, BigInt(event.blockTimestamp), BigInt(1), volume)

    const isClose = event.params.newSize === BigInt(0);
    const isFlip = position.size < BigInt(0) && event.params.newSize > BigInt(0) || position.size > BigInt(0) && event.params.newSize < BigInt(0);

    context.Account.set({
      ...account,
      feesPaid: account.feesPaid + event.params.totalFees - event.params.accruedFunding,
      totalTrades: isClose ? account.totalTrades : account.totalTrades + BigInt(1),
      totalVolume: isClose ? account.totalVolume : account.totalVolume + volume,
    })

    if (isClose) {
      modifiedPosition.isOpen = false;
      modifiedPosition.closeTimestamp = BigInt(event.blockTimestamp);
      modifiedPosition.exitPrice = event.params.fillPrice;
      modifiedPosition.totalReducedNotional = modifiedPosition.totalReducedNotional + notionalValue;

      context.OpenPerpsV3Position.set({
        id: openPositionId,
        position_id: undefined,
      })

      // Calculate PnL method (move to helper function)
      const updatedAccount = await context.Account.get(event.params.accountId.toString());
      const updatedOrder = await context.OrderSettled.get(orderId);

      if (!updatedAccount || !updatedOrder) {
        console.warn(`Account ${event.params.accountId} or Order ${orderId} not found`)
        return
      }

      const pnl = (event.params.fillPrice - modifiedPosition.avgEntryPrice) * getAbs(event.params.sizeDelta) * modifiedPosition.size > BigInt(0) ? BigInt(1) : BigInt(-1) / ETHER;

      modifiedPosition.realizedPnl = modifiedPosition.realizedPnl + pnl;
      modifiedPosition.pnlWithFeesPaid = modifiedPosition.realizedPnl - modifiedPosition.feesPaid + modifiedPosition.netFunding + (interestCharged?.interest || BigInt(0));
      context.OrderSettled.set({
        ...updatedOrder,
        pnl: updatedOrder.pnl + pnl,
      })

      context.Account.set({
        ...updatedAccount,
        pnl: updatedAccount.pnl + pnl,
        pnlWithFeesPaid: updatedAccount.pnlWithFeesPaid + pnl - updatedOrder.totalFees + updatedOrder.accruedFunding + (interestCharged?.interest || BigInt(0)),
      })

      context.PnlSnapshot.set({
        id: `${modifiedPosition.id}-${event.blockTimestamp.toString()}-${event.transactionHash}`,
        pnl,
        timestamp: BigInt(event.blockTimestamp),
        accountId: event.params.accountId,
      })
      // Calculate PnL method END
    } else {
      modifiedPosition.totalTrades = modifiedPosition.totalTrades + BigInt(1);
      modifiedPosition.totalVolume = modifiedPosition.totalVolume + volume;

      if (isFlip) {
        modifiedPosition.avgEntryPrice = event.params.fillPrice;
        modifiedPosition.entryPrice = event.params.fillPrice;
        // Calculate PnL method (move to helper function)
        const updatedAccount = await context.Account.get(event.params.accountId.toString());
        const updatedOrder = await context.OrderSettled.get(orderId);

        if (!updatedAccount || !updatedOrder) {
          console.warn(`Account ${event.params.accountId} or Order ${orderId} not found`)
          return
        }

        const pnl = (event.params.fillPrice - modifiedPosition.avgEntryPrice) * getAbs(event.params.sizeDelta) * modifiedPosition.size > BigInt(0) ? BigInt(1) : BigInt(-1) / ETHER;

        modifiedPosition.realizedPnl = modifiedPosition.realizedPnl + pnl;
        modifiedPosition.pnlWithFeesPaid = modifiedPosition.realizedPnl - modifiedPosition.feesPaid + modifiedPosition.netFunding + (interestCharged?.interest || BigInt(0));
        context.OrderSettled.set({
          ...updatedOrder,
          pnl: updatedOrder.pnl + pnl,
        })

        context.Account.set({
          ...updatedAccount,
          pnl: updatedAccount.pnl + pnl,
          pnlWithFeesPaid: updatedAccount.pnlWithFeesPaid + pnl - updatedOrder.totalFees + updatedOrder.accruedFunding + (interestCharged?.interest || BigInt(0)),
        })

        context.PnlSnapshot.set({
          id: `${modifiedPosition.id}-${event.blockTimestamp.toString()}-${event.transactionHash}`,
          pnl,
          timestamp: BigInt(event.blockTimestamp),
          accountId: event.params.accountId,
        })
        // Calculate PnL method END
      } else if (getAbs(event.params.newSize) > getAbs(position.size)) {
        // If ths positions size is increasing then recalculate the average entry price
        const existingNotional = getAbs(position.size) * position.avgEntryPrice;
        modifiedPosition.avgEntryPrice = (existingNotional + notionalValue) / getAbs(event.params.newSize);
      } else {
        // Calculate PnL method (move to helper function)
        const updatedAccount = await context.Account.get(event.params.accountId.toString());
        const updatedOrder = await context.OrderSettled.get(orderId);

        if (!updatedAccount || !updatedOrder) {
          console.warn(`Account ${event.params.accountId} or Order ${orderId} not found`)
          return
        }

        const pnl = (event.params.fillPrice - modifiedPosition.avgEntryPrice) * getAbs(event.params.sizeDelta) * modifiedPosition.size > BigInt(0) ? BigInt(1) : BigInt(-1) / ETHER;

        modifiedPosition.realizedPnl = modifiedPosition.realizedPnl + pnl;
        modifiedPosition.pnlWithFeesPaid = modifiedPosition.realizedPnl - modifiedPosition.feesPaid + modifiedPosition.netFunding + (interestCharged?.interest || BigInt(0));
        context.OrderSettled.set({
          ...updatedOrder,
          pnl: updatedOrder.pnl + pnl,
        })

        context.Account.set({
          ...updatedAccount,
          pnl: updatedAccount.pnl + pnl,
          pnlWithFeesPaid: updatedAccount.pnlWithFeesPaid + pnl - updatedOrder.totalFees + updatedOrder.accruedFunding + (interestCharged?.interest || BigInt(0)),
        })

        context.PnlSnapshot.set({
          id: `${modifiedPosition.id}-${event.blockTimestamp.toString()}-${event.transactionHash}`,
          pnl,
          timestamp: BigInt(event.blockTimestamp),
          accountId: event.params.accountId,
        })
        // Calculate PnL method END
      }
    }

    context.PerpsV3Position.set(modifiedPosition)
  }
})

PerpsV3MarketProxyContract_OrderCommitted_handler(({ event, context }) => {
  const { acceptablePrice, accountId, commitmentTime, expectedPriceTime, expirationTime, marketId, orderType, sender, settlementTime, sizeDelta, trackingCode } = event.params
  const orderId = `${event.params.accountId.toString()}-${event.blockTimestamp.toString()}`;
  const pendingOrderId = `${event.params.accountId.toString()}-${event.params.marketId.toString()}`;

  context.PendingOrder.set({
    id: pendingOrderId,
    orderCommittedId: orderId,
  })

  context.OrderCommitted.set({
    id: orderId,
    timestamp: BigInt(event.blockTimestamp),
    marketId,
    accountId,
    account_id: accountId.toString(),
    orderType: parseFloat(orderType.toString()),
    sizeDelta,
    acceptablePrice,
    commitmentTime,
    expectedPriceTime,
    settlementTime,
    expirationTime,
    trackingCode,
    sender,
    txnHash: event.transactionHash,
  })
})

const ONE_HOUR_SECONDS = BigInt(3600);
const DAY_SECONDS = BigInt(86400);

const AGG_PERIODS = [ONE_HOUR_SECONDS, DAY_SECONDS];
async function updateAggregateStatEntities(context: PerpsV3MarketProxyContract_OrderCommittedEvent_perpsV3AggregateStatEntityHandlerContextAsync, marketId: bigint, marketSymbol: string, timestamp: bigint, trades: bigint, volume: bigint) {
  for (let period = 0; period < AGG_PERIODS.length; period++) {
    const thisPeriod = AGG_PERIODS[period];
    const aggTimestamp = getTimeID(timestamp, thisPeriod);

    // update the aggregate for this market
    const aggStats = await getOrCreateMarketAggregateStats(context, marketId, marketSymbol, aggTimestamp, thisPeriod);
    context.set({
      ...aggStats,
      trades: aggStats.trades + trades,
      volume: aggStats.volume + volume,
    })

    // update the aggregate for all markets
    const aggCumulativeStats = await getOrCreateMarketAggregateStats(context, BigInt(0), 'ALL', aggTimestamp, thisPeriod);
    context.set({
      ...aggCumulativeStats,
      trades: aggCumulativeStats.trades + trades,
      volume: aggCumulativeStats.volume + volume,
    })
  }
}

export function getTimeID(timestamp: bigint, num: bigint): bigint {
  const remainder = timestamp % num;
  return timestamp - remainder;
}

async function getOrCreateMarketAggregateStats(
  context: PerpsV3MarketProxyContract_OrderCommittedEvent_perpsV3AggregateStatEntityHandlerContextAsync,
  marketId: bigint,
  marketSymbol: string,
  timestamp: bigint,
  period: bigint,
): Promise<perpsV3AggregateStatEntity> {
  // helper function for creating a market aggregate entity if one doesn't exist
  // this allows functions to safely call this function without checking for null
  const id = `${timestamp.toString()}-${period.toString()}-${marketSymbol}`;
  const aggStats = await context.get(id);

  if (aggStats) {
    return aggStats;
  }

  context.set({
    id,
    period,
    timestamp,
    marketId,
    marketSymbol,
    trades: BigInt(0),
    volume: BigInt(0),
  })

  const newAggStats = await context.get(id);

  return newAggStats!;
}
