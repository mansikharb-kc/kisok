// RMS data-access helpers (read-only; in prod read from replica). Phase: P1.2
//
// Core query (heart of RMS): given a block LocationNode, take its `path`, fetch all
// product_copies in the subtree, join brand_products -> brand/category/attributes/media,
// then group per flow (category -> brand -> product -> location).
//
// TODO: implement
//  - getScreenByToken(token)
//  - getBlockSubtreeNodeIds(blockNode)
//  - getRackStock(blockNode)            // "What's in this Rack"
//  - getCategories(branchOrBlock)       // BBC
//  - getBrandsForCategory(categoryId)   // BBB
//  - getProductsForBrand(brandId, categoryId)
//  - getProductDetail(productId)        // shared detail + physical location

export {};
