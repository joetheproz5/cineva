import Foundation

protocol MetadataService { func catalog() async throws -> [Series] }
/// Offline-first metadata service. Replace the bundled catalog with a licensed API integration when needed.
struct BundledMetadataService: MetadataService { func catalog() async throws -> [Series] { [CatalogData.theGoodDoctor] } }
