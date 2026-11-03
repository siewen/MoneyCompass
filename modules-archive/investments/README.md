# Investments module (archived)

Taken out of MoneyCompass in web build 78, kept here for a separate investments app.

- `investments.js` – the Investments page: broker cards (Nexo, XTB, Revolut, eToro, Bybit, Binance with the Poland note), coins with live CoinGecko prices, average buying price, return in %, PIT-38 estimate.
- `invest-import.js` – the Nexo CSV parser (monthly balances, interest, fees, credit-line interest).

Still used by MoneyCompass: the live copies in `docs/app/js/` stay, because the Nexo import to Savings uses `invest-import.js` and the price helpers in `investments.js`. The Investments tab and module switch are removed (`core.js` MODULES, `main.js` MODULE_PAGES); saved `Settings.Modules` entries "investments" are dropped when a profile loads, so the portfolio no longer counts investment positions.

To bring it back in MoneyCompass: re-add the MODULES entry in `core.js`, the import and `investments: Investments` in `main.js`, and remove the filter line in `normalise`.
