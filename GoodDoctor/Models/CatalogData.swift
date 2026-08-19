import Foundation

enum CatalogData {
    static let theGoodDoctor = Series(
        id: "the-good-doctor", title: "The Good Doctor", tagline: "A brilliant mind. An extraordinary journey.",
        synopsis: "A gifted young surgeon begins a new chapter at a prestigious hospital, navigating medicine, ambition, and human connection.",
        year: "2017–2024", rating: "TV-14", genres: ["Drama", "Medical"], seasons: [
            Season(number: 1, episodes: [
                episode(1, 1, "Burnt Food", "A young surgeon arrives to make an unforgettable first impression."),
                episode(1, 2, "Mount Rushmore", "The team faces a difficult case while new bonds form."),
                episode(1, 3, "Oliver", "A personal connection challenges the team’s assumptions."),
                episode(1, 4, "Pipes", "A complex procedure tests everyone in the operating room."),
                episode(1, 5, "Point Three Percent", "A demanding case brings the team together."),
                episode(1, 6, "Not Fake", "Trust and precision become essential in a high-stakes case.")]),
            Season(number: 2, episodes: [episode(2, 1, "Hello", "A new season opens with an unexpected challenge."), episode(2, 2, "Middle Ground", "The hospital confronts difficult choices.")]),
            Season(number: 3, episodes: [episode(3, 1, "Disaster", "A crisis tests the team’s resolve."), episode(3, 2, "Debts", "Old decisions surface in the present.")]),
            Season(number: 4, episodes: [episode(4, 1, "Frontline", "The team adapts to a changing world."), episode(4, 2, "New Normal", "A fresh challenge calls for compassion.")]),
            Season(number: 5, episodes: [episode(5, 1, "New Beginnings", "A fresh start brings new responsibilities."), episode(5, 2, "Piece of Cake", "A routine day becomes anything but.")]),
            Season(number: 6, episodes: [episode(6, 1, "Afterparty", "The team finds its footing again."), episode(6, 2, "Change of Perspective", "A case changes how the team sees each other.")]),
            Season(number: 7, episodes: [episode(7, 1, "Baby, Baby, Baby", "A meaningful new chapter begins."), episode(7, 2, "Skin in the Game", "The hospital confronts a pivotal decision.")])
        ], artworkURL: nil)

    private static func episode(_ season: Int, _ number: Int, _ title: String, _ synopsis: String) -> Episode {
        Episode(id: "the-good-doctor-s\(String(format: "%02d", season))e\(String(format: "%02d", number))", season: season, number: number, title: title, synopsis: synopsis, runtimeMinutes: 43, artworkURL: nil)
    }
}
