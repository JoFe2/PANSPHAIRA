// CSCL-11 iDempiere holdout evidence data.
// 36 source facts (one per capability-family x question slot) and the 16 pinned official files.
// All digests are sha256 of the exact bytes captured at immutable selector 731515dc (refs/heads/release-13).
// sourceBytesSha256 = sha256 of the whole captured file; excerptSha256 = sha256 of fileBytes[byteStart:byteEnd].

export const FACTS = [
  {
    "factId": "idempiere.party-customer-management.objects-roles",
    "family": "PARTY_CUSTOMER_MANAGEMENT",
    "questionId": "objects-roles",
    "state": "SUPPORTED",
    "claim": "M_BPartner is the iDempiere record for a business partner (customer, supplier or vendor); the class carries the party identity and partner role fields.",
    "file": "MBPartner.java",
    "path": "org.adempiere.base/src/org/compiere/model/MBPartner.java",
    "byteStart": 1783,
    "byteEnd": 2392,
    "sourceBytesSha256": "970adb40d1770cef1b25067ab93b0defc246fd013aefc938b015d32d663a1ec3",
    "excerptSha256": "351c6e0f797a4cdb5593124396c8854deda2be910dc61b235c050b3abf3bbf1f"
  },
  {
    "factId": "idempiere.party-customer-management.relations",
    "family": "PARTY_CUSTOMER_MANAGEMENT",
    "questionId": "relations",
    "state": "SUPPORTED",
    "claim": "C_BPartner_Location links a BPartner to a location and carries IsBillTo / IsShipTo role flags, expressing the party-to-location relation.",
    "file": "I_C_BPartner_Location.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_C_BPartner_Location.java",
    "byteStart": 2444,
    "byteEnd": 3827,
    "sourceBytesSha256": "c1cc97defb52fa2e52fd61c2d54c1122a4dda238b86ab4375e799bb32d9ecfec",
    "excerptSha256": "7913f7c28259db98d80fa24e856e4e7b22e77bab512fd68ea40f88e3dbfebfe4"
  },
  {
    "factId": "idempiere.party-customer-management.operations",
    "family": "PARTY_CUSTOMER_MANAGEMENT",
    "questionId": "operations",
    "state": "SUPPORTED",
    "claim": "MBPartner.getTemplate constructs a reset business-partner template (an operation on the party object).",
    "file": "MBPartner.java",
    "path": "org.adempiere.base/src/org/compiere/model/MBPartner.java",
    "byteStart": 2504,
    "byteEnd": 2838,
    "sourceBytesSha256": "970adb40d1770cef1b25067ab93b0defc246fd013aefc938b015d32d663a1ec3",
    "excerptSha256": "45620b47c28156d8c1070d8e626008cd053b7bfeebc6088621cc5003d7c8f394"
  },
  {
    "factId": "idempiere.party-customer-management.inputs-outputs",
    "family": "PARTY_CUSTOMER_MANAGEMENT",
    "questionId": "inputs-outputs",
    "state": "SUPPORTED",
    "claim": "MBPartnerLocation.get(ctx, C_BPartner_Location_ID) returns the partner location record (input: id, output: record).",
    "file": "MBPartnerLocation.java",
    "path": "org.adempiere.base/src/org/compiere/model/MBPartnerLocation.java",
    "byteStart": 2029,
    "byteEnd": 2549,
    "sourceBytesSha256": "c495d4065848094ffcbccba8c9695518792bb407ac65c9729d4d8150bbd15cfb",
    "excerptSha256": "ffb7350c723626a0b62bf3d4d9f80e37e075998a7c8c71bb69305f4033bc89a4"
  },
  {
    "factId": "idempiere.party-customer-management.states-transitions",
    "family": "PARTY_CUSTOMER_MANAGEMENT",
    "questionId": "states-transitions",
    "state": "SUPPORTED",
    "claim": "IsActive is a Boolean column on C_BPartner (the party active state).",
    "file": "I_C_BPartner.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_C_BPartner.java",
    "byteStart": 12734,
    "byteEnd": 12891,
    "sourceBytesSha256": "7bef3437bf13bbf29b6b663a5a0c8a7f3b804be439f5971069c23291336b9f5f",
    "excerptSha256": "4713523ac1cd1ad9bc82e6247ecf8ab5bd1115d03fb8bcf717349ae309677658"
  },
  {
    "factId": "idempiere.party-customer-management.events",
    "family": "PARTY_CUSTOMER_MANAGEMENT",
    "questionId": "events",
    "state": "ABSENT",
    "claim": "Within the captured MBPartner save/template methods, no event publish/subscribe or change-notification mechanism is declared for party changes.",
    "file": "MBPartner.java",
    "path": "org.adempiere.base/src/org/compiere/model/MBPartner.java",
    "byteStart": 2839,
    "byteEnd": 4046,
    "sourceBytesSha256": "970adb40d1770cef1b25067ab93b0defc246fd013aefc938b015d32d663a1ec3",
    "excerptSha256": "9d817ce52fa9054a1b3224ab020ac208a9d5975b4a86dfb9aa39566abdff5f99"
  },
  {
    "factId": "idempiere.party-customer-management.preconditions",
    "family": "PARTY_CUSTOMER_MANAGEMENT",
    "questionId": "preconditions",
    "state": "SUPPORTED",
    "claim": "MBPartner.getTemplate throws IllegalArgumentException when Client_ID=0 (a precondition on the client context).",
    "file": "MBPartner.java",
    "path": "org.adempiere.base/src/org/compiere/model/MBPartner.java",
    "byteStart": 12679,
    "byteEnd": 12853,
    "sourceBytesSha256": "970adb40d1770cef1b25067ab93b0defc246fd013aefc938b015d32d663a1ec3",
    "excerptSha256": "d2337506178ed0caf7b687895f03c470aa6971c3de93c5e8e05ef4f3f5670695"
  },
  {
    "factId": "idempiere.party-customer-management.invariants",
    "family": "PARTY_CUSTOMER_MANAGEMENT",
    "questionId": "invariants",
    "state": "SUPPORTED",
    "claim": "MBPartner.getLocations queries C_BPartner_Location WHERE IsActive='Y' (only active locations are exposed, an invariant).",
    "file": "MBPartner.java",
    "path": "org.adempiere.base/src/org/compiere/model/MBPartner.java",
    "byteStart": 15107,
    "byteEnd": 15558,
    "sourceBytesSha256": "970adb40d1770cef1b25067ab93b0defc246fd013aefc938b015d32d663a1ec3",
    "excerptSha256": "620fd635c585ebf61aa029b31901597475b9d042887d90412e1858de9f6c397a"
  },
  {
    "factId": "idempiere.party-customer-management.exceptions-errors",
    "family": "PARTY_CUSTOMER_MANAGEMENT",
    "questionId": "exceptions-errors",
    "state": "SUPPORTED",
    "claim": "MBPartner wraps a DB read in try/catch and logs the failure at SEVERE (error handling for party reads).",
    "file": "MBPartner.java",
    "path": "org.adempiere.base/src/org/compiere/model/MBPartner.java",
    "byteStart": 7244,
    "byteEnd": 7566,
    "sourceBytesSha256": "970adb40d1770cef1b25067ab93b0defc246fd013aefc938b015d32d663a1ec3",
    "excerptSha256": "29034e066f1e1fefc85a3ee621598a492204775fee1a6886f8e1136980967224"
  },
  {
    "factId": "idempiere.party-customer-management.readbacks",
    "family": "PARTY_CUSTOMER_MANAGEMENT",
    "questionId": "readbacks",
    "state": "SUPPORTED",
    "claim": "MBPartnerLocation reads back the locations for a partner (readback operation).",
    "file": "MBPartnerLocation.java",
    "path": "org.adempiere.base/src/org/compiere/model/MBPartnerLocation.java",
    "byteStart": 2029,
    "byteEnd": 2559,
    "sourceBytesSha256": "c495d4065848094ffcbccba8c9695518792bb407ac65c9729d4d8150bbd15cfb",
    "excerptSha256": "3d3c424f2a2e0a5619bbd9b3b8737e0ecc3f30d5f98429aee94187b0a2328c42"
  },
  {
    "factId": "idempiere.party-customer-management.api-service-exposure",
    "family": "PARTY_CUSTOMER_MANAGEMENT",
    "questionId": "api-service-exposure",
    "state": "ABSENT",
    "claim": "No RMI / web-service / REST endpoint exposing party operations is declared in the captured C_BPartner interface.",
    "file": "I_C_BPartner.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_C_BPartner.java",
    "byteStart": 12544,
    "byteEnd": 13196,
    "sourceBytesSha256": "7bef3437bf13bbf29b6b663a5a0c8a7f3b804be439f5971069c23291336b9f5f",
    "excerptSha256": "09e171d2d6070758e496c27b4b0cf878574293a79b4ca621c7e60b9bdd487637"
  },
  {
    "factId": "idempiere.party-customer-management.absence-ambiguity-conflict",
    "family": "PARTY_CUSTOMER_MANAGEMENT",
    "questionId": "absence-ambiguity-conflict",
    "state": "ABSENT",
    "claim": "No explicit conflict- or ambiguity-resolution marker (duplicate/merge) is declared for party identity in the captured C_BPartner columns.",
    "file": "I_C_BPartner.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_C_BPartner.java",
    "byteStart": 27792,
    "byteEnd": 28113,
    "sourceBytesSha256": "7bef3437bf13bbf29b6b663a5a0c8a7f3b804be439f5971069c23291336b9f5f",
    "excerptSha256": "12d71483d08aa5c5f1f025bac05d60c20cf4c590e9bba246cd6d2c2d7ee9acf6"
  },
  {
    "factId": "idempiere.product-item-management.objects-roles",
    "family": "PRODUCT_ITEM_MANAGEMENT",
    "questionId": "objects-roles",
    "state": "SUPPORTED",
    "claim": "MProduct is the iDempiere record for a product/item (the offering); the class carries Name, ProductType and role flags (IsSold/IsPurchased/IsStocked).",
    "file": "MProduct.java",
    "path": "org.adempiere.base/src/org/compiere/model/MProduct.java",
    "byteStart": 1894,
    "byteEnd": 2721,
    "sourceBytesSha256": "a9377e7ae32dce65a862f5106f199ca835dbede460a2c633acea766d1a5a670d",
    "excerptSha256": "2077d16d54caf874111f9422738d26a981f13023a65b39a41b4b03a78edc49c5"
  },
  {
    "factId": "idempiere.product-item-management.relations",
    "family": "PRODUCT_ITEM_MANAGEMENT",
    "questionId": "relations",
    "state": "SUPPORTED",
    "claim": "M_Product.Category_ID links a product to M_Product_Category (the product-to-category relation).",
    "file": "I_M_Product.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_M_Product.java",
    "byteStart": 18341,
    "byteEnd": 18714,
    "sourceBytesSha256": "ea0b281093dc554c64bb4a37e2204d4a10f6a4d09b8c080b3dea8572bb6269ca",
    "excerptSha256": "5c64c6dd008e7c4d4dcc98b37574e1ea27e6e0d87433c62acf81a5825dcba0c1"
  },
  {
    "factId": "idempiere.product-item-management.operations",
    "family": "PRODUCT_ITEM_MANAGEMENT",
    "questionId": "operations",
    "state": "SUPPORTED",
    "claim": "MProduct.beforeSave validates and prepares the product record before persisting (an operation on the product object).",
    "file": "MProduct.java",
    "path": "org.adempiere.base/src/org/compiere/model/MProduct.java",
    "byteStart": 18552,
    "byteEnd": 19580,
    "sourceBytesSha256": "a9377e7ae32dce65a862f5106f199ca835dbede460a2c633acea766d1a5a670d",
    "excerptSha256": "1f20ebea339458c1e0d483201d77e5f2a1c6d3f1c9973ca6a3c898523ef8e338"
  },
  {
    "factId": "idempiere.product-item-management.inputs-outputs",
    "family": "PRODUCT_ITEM_MANAGEMENT",
    "questionId": "inputs-outputs",
    "state": "SUPPORTED",
    "claim": "MProduct.get(ctx, M_Product_ID) returns the product record (input: id, output: record).",
    "file": "MProduct.java",
    "path": "org.adempiere.base/src/org/compiere/model/MProduct.java",
    "byteStart": 2833,
    "byteEnd": 3548,
    "sourceBytesSha256": "a9377e7ae32dce65a862f5106f199ca835dbede460a2c633acea766d1a5a670d",
    "excerptSha256": "169478c76356a75e556aa27f52ea3c26024d0e25783172dbaf070afc322c24fd"
  },
  {
    "factId": "idempiere.product-item-management.states-transitions",
    "family": "PRODUCT_ITEM_MANAGEMENT",
    "questionId": "states-transitions",
    "state": "SUPPORTED",
    "claim": "Discontinued is a Boolean (with DiscontinuedAt date) on M_Product (the product lifecycle state).",
    "file": "I_M_Product.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_M_Product.java",
    "byteStart": 6390,
    "byteEnd": 6871,
    "sourceBytesSha256": "ea0b281093dc554c64bb4a37e2204d4a10f6a4d09b8c080b3dea8572bb6269ca",
    "excerptSha256": "bb79db5cd6ced29b3badcdd4bd4cbe3ee81fe5d1af03e420f4653ff24fbdeac8"
  },
  {
    "factId": "idempiere.product-item-management.events",
    "family": "PRODUCT_ITEM_MANAGEMENT",
    "questionId": "events",
    "state": "ABSENT",
    "claim": "Within the captured MProduct get methods, no event publish/subscribe or change-notification mechanism is declared for product changes.",
    "file": "MProduct.java",
    "path": "org.adempiere.base/src/org/compiere/model/MProduct.java",
    "byteStart": 2833,
    "byteEnd": 3548,
    "sourceBytesSha256": "a9377e7ae32dce65a862f5106f199ca835dbede460a2c633acea766d1a5a670d",
    "excerptSha256": "169478c76356a75e556aa27f52ea3c26024d0e25783172dbaf070afc322c24fd"
  },
  {
    "factId": "idempiere.product-item-management.preconditions",
    "family": "PRODUCT_ITEM_MANAGEMENT",
    "questionId": "preconditions",
    "state": "SUPPORTED",
    "claim": "MProduct.beforeSave enforces product preconditions before persisting the record.",
    "file": "MProduct.java",
    "path": "org.adempiere.base/src/org/compiere/model/MProduct.java",
    "byteStart": 18853,
    "byteEnd": 19529,
    "sourceBytesSha256": "a9377e7ae32dce65a862f5106f199ca835dbede460a2c633acea766d1a5a670d",
    "excerptSha256": "2afb85e039e0bf52f5529e1b067edae933103e636d41dbcdebc734c32b218da6"
  },
  {
    "factId": "idempiere.product-item-management.invariants",
    "family": "PRODUCT_ITEM_MANAGEMENT",
    "questionId": "invariants",
    "state": "SUPPORTED",
    "claim": "MProduct.beforeDelete throws when a resource product has S_Resource_ID<>0 (a delete invariant).",
    "file": "MProduct.java",
    "path": "org.adempiere.base/src/org/compiere/model/MProduct.java",
    "byteStart": 28170,
    "byteEnd": 28516,
    "sourceBytesSha256": "a9377e7ae32dce65a862f5106f199ca835dbede460a2c633acea766d1a5a670d",
    "excerptSha256": "fe061c38c0c1f748e40380a57bb7a30dfca67383331fd7e9ac58ee53b097f4be"
  },
  {
    "factId": "idempiere.product-item-management.exceptions-errors",
    "family": "PRODUCT_ITEM_MANAGEMENT",
    "questionId": "exceptions-errors",
    "state": "SUPPORTED",
    "claim": "MProduct throws AdempiereException on invariant violation (error reporting for product).",
    "file": "MProduct.java",
    "path": "org.adempiere.base/src/org/compiere/model/MProduct.java",
    "byteStart": 28182,
    "byteEnd": 28516,
    "sourceBytesSha256": "a9377e7ae32dce65a862f5106f199ca835dbede460a2c633acea766d1a5a670d",
    "excerptSha256": "e423dee733c157788f6405d504534aacc412dd12c4f650fbbd64057d33b3ab71"
  },
  {
    "factId": "idempiere.product-item-management.readbacks",
    "family": "PRODUCT_ITEM_MANAGEMENT",
    "questionId": "readbacks",
    "state": "SUPPORTED",
    "claim": "MProduct reads back the product record from the cache/DB (readback).",
    "file": "MProduct.java",
    "path": "org.adempiere.base/src/org/compiere/model/MProduct.java",
    "byteStart": 2833,
    "byteEnd": 3052,
    "sourceBytesSha256": "a9377e7ae32dce65a862f5106f199ca835dbede460a2c633acea766d1a5a670d",
    "excerptSha256": "741f6fd4074fe87b32cfec8f7605d8e8389bab852d49c702d531612f2b9a831c"
  },
  {
    "factId": "idempiere.product-item-management.api-service-exposure",
    "family": "PRODUCT_ITEM_MANAGEMENT",
    "questionId": "api-service-exposure",
    "state": "ABSENT",
    "claim": "No RMI / web-service / REST endpoint exposing product operations is declared in the captured M_Product interface.",
    "file": "I_M_Product.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_M_Product.java",
    "byteStart": 19492,
    "byteEnd": 20139,
    "sourceBytesSha256": "ea0b281093dc554c64bb4a37e2204d4a10f6a4d09b8c080b3dea8572bb6269ca",
    "excerptSha256": "dc756c64cd08765595658f25d8392424c94ffa1fe495315d790bf0bfb92e8d02"
  },
  {
    "factId": "idempiere.product-item-management.absence-ambiguity-conflict",
    "family": "PRODUCT_ITEM_MANAGEMENT",
    "questionId": "absence-ambiguity-conflict",
    "state": "ABSENT",
    "claim": "No explicit conflict- or ambiguity-resolution marker (duplicate/merge) is declared for product identity in the captured M_Product columns.",
    "file": "I_M_Product.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_M_Product.java",
    "byteStart": 24811,
    "byteEnd": 25040,
    "sourceBytesSha256": "ea0b281093dc554c64bb4a37e2204d4a10f6a4d09b8c080b3dea8572bb6269ca",
    "excerptSha256": "d4304dc12b426e122ae3f7a667db512d6da34e4792de56830a529b5133d3addb"
  },
  {
    "factId": "idempiere.sales-order-management.objects-roles",
    "family": "SALES_ORDER_MANAGEMENT",
    "questionId": "objects-roles",
    "state": "SUPPORTED",
    "claim": "MOrder is the iDempiere record for a sales order; the class carries the order identity, doc type and header fields.",
    "file": "MOrder.java",
    "path": "org.adempiere.base/src/org/compiere/model/MOrder.java",
    "byteStart": 2651,
    "byteEnd": 3415,
    "sourceBytesSha256": "f41fe130cca88cf133dc8f5159e991ee05702382d7db389df0ac1e29dee7e518",
    "excerptSha256": "9d5995f53198c8e7a9c14dd45f0c9273b372c9e87ddf5e49e12782791ef25bb6"
  },
  {
    "factId": "idempiere.sales-order-management.relations",
    "family": "SALES_ORDER_MANAGEMENT",
    "questionId": "relations",
    "state": "SUPPORTED",
    "claim": "C_Order.C_BPartner_ID links the order header to the business partner (header-to-party relation).",
    "file": "I_C_Order.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_C_Order.java",
    "byteStart": 5728,
    "byteEnd": 5903,
    "sourceBytesSha256": "3c1867dc69f2ea88243b93ed6734342c9c504c3f4833b3e08eef8cb38029215a",
    "excerptSha256": "e8f59b6477c88893c6e36d79d8fb5d9b83a880849c99c2d6a1dda3b059b692ad"
  },
  {
    "factId": "idempiere.sales-order-management.operations",
    "family": "SALES_ORDER_MANAGEMENT",
    "questionId": "operations",
    "state": "SUPPORTED",
    "claim": "MOrder performs a document action on the sales order (an operation).",
    "file": "MOrder.java",
    "path": "org.adempiere.base/src/org/compiere/model/MOrder.java",
    "byteStart": 35858,
    "byteEnd": 36303,
    "sourceBytesSha256": "f41fe130cca88cf133dc8f5159e991ee05702382d7db389df0ac1e29dee7e518",
    "excerptSha256": "6507319e6ea311529ffd355520f7e29f455757f92ab5b862fb10f2a4762c9ce2"
  },
  {
    "factId": "idempiere.sales-order-management.inputs-outputs",
    "family": "SALES_ORDER_MANAGEMENT",
    "questionId": "inputs-outputs",
    "state": "SUPPORTED",
    "claim": "MOrderLine documents the order-line input/output fields (product, quantity, price, priceActual, tax) in its usage contract.",
    "file": "MOrderLine.java",
    "path": "org.adempiere.base/src/org/compiere/model/MOrderLine.java",
    "byteStart": 1977,
    "byteEnd": 2210,
    "sourceBytesSha256": "e990a28298d9fb2afa4a0c7c72d10be5997e8402e2c98c0babe0541e033cf945",
    "excerptSha256": "d1a392190496f7f7630c09bd355393578b49903d65ed437f618c390469502f28"
  },
  {
    "factId": "idempiere.sales-order-management.states-transitions",
    "family": "SALES_ORDER_MANAGEMENT",
    "questionId": "states-transitions",
    "state": "SUPPORTED",
    "claim": "DocStatus is a column on C_Order (the order document status).",
    "file": "I_C_Order.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_C_Order.java",
    "byteStart": 17932,
    "byteEnd": 18105,
    "sourceBytesSha256": "3c1867dc69f2ea88243b93ed6734342c9c504c3f4833b3e08eef8cb38029215a",
    "excerptSha256": "a17ca4bf17d2d952c3f328c9cc2c142b5048772b7b604f9289698c102bfad37b"
  },
  {
    "factId": "idempiere.sales-order-management.events",
    "family": "SALES_ORDER_MANAGEMENT",
    "questionId": "events",
    "state": "ABSENT",
    "claim": "Within the captured MOrder reserveStock/explodeBOM methods, no event publish/subscribe or change-notification mechanism is declared for order changes.",
    "file": "MOrder.java",
    "path": "org.adempiere.base/src/org/compiere/model/MOrder.java",
    "byteStart": 62020,
    "byteEnd": 62618,
    "sourceBytesSha256": "f41fe130cca88cf133dc8f5159e991ee05702382d7db389df0ac1e29dee7e518",
    "excerptSha256": "44fc9de40de203e481f8cb7379a3363132e5d11eea52e21ccdf5f81738c97cc3"
  },
  {
    "factId": "idempiere.sales-order-management.preconditions",
    "family": "SALES_ORDER_MANAGEMENT",
    "questionId": "preconditions",
    "state": "SUPPORTED",
    "claim": "MOrder validates address/billing preconditions before processing (preconditions).",
    "file": "MOrder.java",
    "path": "org.adempiere.base/src/org/compiere/model/MOrder.java",
    "byteStart": 26386,
    "byteEnd": 27062,
    "sourceBytesSha256": "f41fe130cca88cf133dc8f5159e991ee05702382d7db389df0ac1e29dee7e518",
    "excerptSha256": "36234217c34815bc5891c69b1917ce55087ea6f0de020a7ce861b479fedb3324"
  },
  {
    "factId": "idempiere.sales-order-management.invariants",
    "family": "SALES_ORDER_MANAGEMENT",
    "questionId": "invariants",
    "state": "SUPPORTED",
    "claim": "MOrder throws IllegalStateException when order/line creation fails (creation invariants).",
    "file": "MOrder.java",
    "path": "org.adempiere.base/src/org/compiere/model/MOrder.java",
    "byteStart": 16242,
    "byteEnd": 16606,
    "sourceBytesSha256": "f41fe130cca88cf133dc8f5159e991ee05702382d7db389df0ac1e29dee7e518",
    "excerptSha256": "800f7db12d30b4ac13ff54840952c867e8c52cc8137f157df01e02620ef02395"
  },
  {
    "factId": "idempiere.sales-order-management.exceptions-errors",
    "family": "SALES_ORDER_MANAGEMENT",
    "questionId": "exceptions-errors",
    "state": "SUPPORTED",
    "claim": "MOrder throws DBException/AdempiereException on order errors (error reporting).",
    "file": "MOrder.java",
    "path": "org.adempiere.base/src/org/compiere/model/MOrder.java",
    "byteStart": 26863,
    "byteEnd": 27062,
    "sourceBytesSha256": "f41fe130cca88cf133dc8f5159e991ee05702382d7db389df0ac1e29dee7e518",
    "excerptSha256": "61f7d465270e56a0113b9fe80babd19aec88bf25a50609e895ae534de2a2c1b1"
  },
  {
    "factId": "idempiere.sales-order-management.readbacks",
    "family": "SALES_ORDER_MANAGEMENT",
    "questionId": "readbacks",
    "state": "SUPPORTED",
    "claim": "MOrder defines a matching GROUP BY SQL template used to read back open order quantities.",
    "file": "MOrder.java",
    "path": "org.adempiere.base/src/org/compiere/model/MOrder.java",
    "byteStart": 4326,
    "byteEnd": 4640,
    "sourceBytesSha256": "f41fe130cca88cf133dc8f5159e991ee05702382d7db389df0ac1e29dee7e518",
    "excerptSha256": "a64118e02060cdf3747a2168c915e5007309124c71a7993cb61938f595df9812"
  },
  {
    "factId": "idempiere.sales-order-management.api-service-exposure",
    "family": "SALES_ORDER_MANAGEMENT",
    "questionId": "api-service-exposure",
    "state": "ABSENT",
    "claim": "No RMI / web-service / REST endpoint exposing sales operations is declared in the captured MOrderLine.",
    "file": "MOrderLine.java",
    "path": "org.adempiere.base/src/org/compiere/model/MOrderLine.java",
    "byteStart": 1977,
    "byteEnd": 2210,
    "sourceBytesSha256": "e990a28298d9fb2afa4a0c7c72d10be5997e8402e2c98c0babe0541e033cf945",
    "excerptSha256": "d1a392190496f7f7630c09bd355393578b49903d65ed437f618c390469502f28"
  },
  {
    "factId": "idempiere.sales-order-management.absence-ambiguity-conflict",
    "family": "SALES_ORDER_MANAGEMENT",
    "questionId": "absence-ambiguity-conflict",
    "state": "SUPPORTED",
    "claim": "MOrder logs a WarehouseOrgConflict warning when the warehouse and order document belong to different organizations (a conflict marker).",
    "file": "MOrder.java",
    "path": "org.adempiere.base/src/org/compiere/model/MOrder.java",
    "byteStart": 38793,
    "byteEnd": 39190,
    "sourceBytesSha256": "f41fe130cca88cf133dc8f5159e991ee05702382d7db389df0ac1e29dee7e518",
    "excerptSha256": "0065756e5aec5401245cce28c20fb953f1167f47cf1f8c2f15fbb8388db940c8"
  }
];

export const FILES = [
  {
    "name": "I_C_BPartner.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_C_BPartner.java",
    "byteLength": 28116,
    "sha256": "7bef3437bf13bbf29b6b663a5a0c8a7f3b804be439f5971069c23291336b9f5f"
  },
  {
    "name": "I_C_BPartner_Location.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_C_BPartner_Location.java",
    "byteLength": 8907,
    "sha256": "c1cc97defb52fa2e52fd61c2d54c1122a4dda238b86ab4375e799bb32d9ecfec"
  },
  {
    "name": "I_C_Location.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_C_Location.java",
    "byteLength": 9409,
    "sha256": "8181381692fab844667e4a6f4bcd79a926b52671e8e14d45b06a4d9e8a0419b3"
  },
  {
    "name": "I_C_Order.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_C_Order.java",
    "byteLength": 36547,
    "sha256": "3c1867dc69f2ea88243b93ed6734342c9c504c3f4833b3e08eef8cb38029215a"
  },
  {
    "name": "I_C_OrderLine.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_C_OrderLine.java",
    "byteLength": 23828,
    "sha256": "1efe83ab7cefe9623f2af322f298eedab602e2404f51911cedc9ff9a6f25a1e3"
  },
  {
    "name": "I_M_Product.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_M_Product.java",
    "byteLength": 25882,
    "sha256": "ea0b281093dc554c64bb4a37e2204d4a10f6a4d09b8c080b3dea8572bb6269ca"
  },
  {
    "name": "I_M_Product_Category.java",
    "path": "org.adempiere.base/src/org/compiere/model/I_M_Product_Category.java",
    "byteLength": 8010,
    "sha256": "c79eb991db5513ab2a074d670266388ac8476de860754298e1358e7734d610d4"
  },
  {
    "name": "MBPartner.java",
    "path": "org.adempiere.base/src/org/compiere/model/MBPartner.java",
    "byteLength": 30989,
    "sha256": "970adb40d1770cef1b25067ab93b0defc246fd013aefc938b015d32d663a1ec3"
  },
  {
    "name": "MBPartnerLocation.java",
    "path": "org.adempiere.base/src/org/compiere/model/MBPartnerLocation.java",
    "byteLength": 8858,
    "sha256": "c495d4065848094ffcbccba8c9695518792bb407ac65c9729d4d8150bbd15cfb"
  },
  {
    "name": "MOrder.java",
    "path": "org.adempiere.base/src/org/compiere/model/MOrder.java",
    "byteLength": 104734,
    "sha256": "f41fe130cca88cf133dc8f5159e991ee05702382d7db389df0ac1e29dee7e518"
  },
  {
    "name": "MOrderLine.java",
    "path": "org.adempiere.base/src/org/compiere/model/MOrderLine.java",
    "byteLength": 30799,
    "sha256": "e990a28298d9fb2afa4a0c7c72d10be5997e8402e2c98c0babe0541e033cf945"
  },
  {
    "name": "MProduct.java",
    "path": "org.adempiere.base/src/org/compiere/model/MProduct.java",
    "byteLength": 36264,
    "sha256": "a9377e7ae32dce65a862f5106f199ca835dbede460a2c633acea766d1a5a670d"
  },
  {
    "name": "MProductCategory.java",
    "path": "org.adempiere.base/src/org/compiere/model/MProductCategory.java",
    "byteLength": 10214,
    "sha256": "55528cb9f0505cc3da8d92f516e8f36bd3c16c2fc21e3fc513081e6b3919093d"
  },
  {
    "name": "overview.html",
    "path": "org.adempiere.base/src/org/compiere/model/overview.html",
    "byteLength": 323,
    "sha256": "683f72cba8b7463b6def85c6423b04e58f0086c76216728947f1cb5bdf85e37f"
  },
  {
    "name": "LICENSE.md",
    "path": "LICENSE.md",
    "byteLength": 15057,
    "sha256": "ff71df08df5d013473e420dfe5a0208f4dfdadbade1805204afc6f586a6f7624"
  },
  {
    "name": "README.md",
    "path": "README.md",
    "byteLength": 3486,
    "sha256": "83de5b14fceeb3dafff7bd938aab5422471672e839d8415cf7cfe57a1ceb6742"
  }
];
