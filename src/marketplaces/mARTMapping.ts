import { sale, transaction, currency, wethTransaction } from "../../generated/schema";

import { MatchTransferWithSale } from "../utils/matchTransferSale";

import { ItemSold } from "../../generated/Contract/Contract";

import { ERC20Contracts } from "../graphprotocol-utils";

import { BigDecimal, Address } from "@graphprotocol/graph-ts";

// TakerAsk Handler starts here
export function handleItemSale(event: ItemSold): void {
  //1. load transaction
  let tx = transaction.load(event.transaction.hash.toHexString());

  //2. nullcheck transaction entity (one should already exist for the transfer earlier in that)
  if (tx) {
    //3. create new sale entity (id = tx hash - eventId)
    let saleEntity = sale.load(event.block.number.toString() + "-" + event.logIndex.toString());

    if (!saleEntity && tx.unmatchedTransferCount > 0) {
      // Assume default value of currency as phony ERC20
      let currencyAddress: Address = Address.fromString("0xf75150d730ce97c1551e97df39c0a049024e4c25"); //update to unknown ERC20

      let currencyEntity = ERC20Contracts.getERC20(currencyAddress);

      if (currencyEntity) {
        //4. Assign currency address, amount, txId and platform to sale entity
        let saleEntity = new sale(event.block.number.toString() + "-" + event.logIndex.toString());
        saleEntity.transaction = tx.id;
        saleEntity.currency = currencyEntity.id;
        saleEntity.platform = "mART";
        saleEntity.amount = event.params.price.divDecimal(BigDecimal.fromString("1000000000000000000"));
        saleEntity.blockNumber = event.block.number.toI32();
        saleEntity.timestamp = event.block.timestamp.toI32();
        saleEntity.save();

        //5. Assign sale.amount / transaction.unmatchedTransferCount to variable transferAmount to pass into transfer entities
        // This will derives the amount per transfer (eg each nft's amount in a bundle with 2 NFT's is the total price divided by 2.)
        let transferAmount = saleEntity.amount.div(BigDecimal.fromString(tx.unmatchedTransferCount.toString()));

        //6. Using unmatchedTransferId loop through the transfer entities and apply the transferAmount and assign saleId ,
        //reducing the unmatchedTransferCount by 1. save transfer update on each loop.
        if (tx.transfers && transferAmount && tx.id && saleEntity.id) {
          let array = tx.transfers;
          for (let index = 0; index < array.length; index++) {
            let trId = array[index];

            MatchTransferWithSale(trId, transferAmount, tx.id, saleEntity.id, currencyEntity.symbol);
          }
        }
      }
    }
  }
}
