import SwiftUI
import UIKit
import Combine

@MainActor final class ArtworkLoader: ObservableObject {
    static let shared = ArtworkLoader(); private let cache = NSCache<NSURL, UIImage>()
    func image(for url: URL) async -> UIImage? {
        if let cached = cache.object(forKey: url as NSURL) { return cached }
        guard let (data, response) = try? await URLSession.shared.data(from: url), (response as? HTTPURLResponse)?.statusCode == 200, let image = UIImage(data: data) else { return nil }
        cache.setObject(image, forKey: url as NSURL); return image
    }
}
