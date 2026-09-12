import Foundation

struct SentinelWeatherService {
    func forecast(latitude: Double, longitude: Double) async throws -> SentinelWeather {
        var components = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        components.queryItems = [
            URLQueryItem(name: "latitude", value: String(latitude)),
            URLQueryItem(name: "longitude", value: String(longitude)),
            URLQueryItem(name: "current", value: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m"),
            URLQueryItem(name: "hourly", value: "temperature_2m,precipitation_probability"),
            URLQueryItem(name: "daily", value: "weather_code,temperature_2m_max,temperature_2m_min"),
            URLQueryItem(name: "forecast_days", value: "7"),
            URLQueryItem(name: "timezone", value: "auto")
        ]
        let (data, response) = try await URLSession.shared.data(from: components.url!)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        return try JSONDecoder().decode(SentinelWeather.self, from: data)
    }
}

struct SentinelWeather: Codable {
    let current: Current
    let hourly: Hourly
    let daily: Daily

    struct Current: Codable {
        let temperature2m: Double
        let apparentTemperature: Double
        let weatherCode: Int
        let windSpeed10m: Double
        enum CodingKeys: String, CodingKey { case temperature2m = "temperature_2m", apparentTemperature = "apparent_temperature", weatherCode = "weather_code", windSpeed10m = "wind_speed_10m" }
    }

    struct Hourly: Codable {
        let time: [String]
        let temperature2m: [Double]
        let precipitationProbability: [Int]
        enum CodingKeys: String, CodingKey { case time, temperature2m = "temperature_2m", precipitationProbability = "precipitation_probability" }
    }

    struct Daily: Codable {
        let time: [String]
        let weatherCode: [Int]
        let temperature2mMax: [Double]
        let temperature2mMin: [Double]
        enum CodingKeys: String, CodingKey { case time, weatherCode = "weather_code", temperature2mMax = "temperature_2m_max", temperature2mMin = "temperature_2m_min" }
    }
}

extension SentinelWeather {
    var conditionName: String { Self.conditionName(for: current.weatherCode) }
    var symbol: String { Self.symbol(for: current.weatherCode) }

    static func conditionName(for code: Int) -> String {
        switch code {
        case 0: "Clear sky"; case 1...3: "Partly cloudy"; case 45, 48: "Fog"; case 51...57: "Drizzle"; case 61...67: "Rain"; case 71...77: "Snow"; case 80...82: "Rain showers"; case 85, 86: "Snow showers"; case 95...99: "Thunderstorm"; default: "Unknown conditions"
        }
    }

    static func symbol(for code: Int) -> String {
        switch code { case 0: "sun.max.fill"; case 1...3: "cloud.sun.fill"; case 45, 48: "cloud.fog.fill"; case 51...67, 80...82: "cloud.rain.fill"; case 71...77, 85, 86: "cloud.snow.fill"; case 95...99: "cloud.bolt.rain.fill"; default: "cloud.fill" }
    }

    static func conditionCode(for condition: String) -> Int {
        let value = condition.lowercased()
        if value.contains("thunder") { return 95 }
        if value.contains("snow") || value.contains("sleet") { return 71 }
        if value.contains("rain") || value.contains("shower") { return 61 }
        if value.contains("drizzle") { return 51 }
        if value.contains("fog") || value.contains("mist") { return 45 }
        if value.contains("cloud") || value.contains("overcast") { return 2 }
        return 0
    }
}

struct SentinelWeatherAPIResponse: Decodable {
    struct Location: Decodable { let name: String; let region: String; let country: String; let localtime: String }
    struct Condition: Decodable { let text: String; let icon: String }
    struct Current: Decodable { let tempC: Double; let feelslikeC: Double; let condition: Condition; let windKph: Double; let windDir: String; let humidity: Int; let precipMm: Double; let visKm: Double; let uv: Double
        enum CodingKeys: String, CodingKey { case tempC = "temp_c", feelslikeC = "feelslike_c", condition, windKph = "wind_kph", windDir = "wind_dir", humidity, precipMm = "precip_mm", visKm = "vis_km", uv }
    }
    struct Day: Decodable { let maxtempC: Double; let mintempC: Double; let avgtempC: Double; let dailyChanceOfRain: Int; let condition: Condition
        enum CodingKeys: String, CodingKey { case maxtempC = "maxtemp_c", mintempC = "mintemp_c", avgtempC = "avgtemp_c", dailyChanceOfRain = "daily_chance_of_rain", condition }
    }
    struct Hour: Decodable { let time: String; let tempC: Double; let feelslikeC: Double; let chanceOfRain: Int; let precipMm: Double; let willItRain: Int; let condition: Condition
        enum CodingKeys: String, CodingKey { case time, tempC = "temp_c", feelslikeC = "feelslike_c", chanceOfRain = "chance_of_rain", precipMm = "precip_mm", willItRain = "will_it_rain", condition }
    }
    struct ForecastDay: Decodable { let date: String; let day: Day; let hour: [Hour] }
    struct Forecast: Decodable { let forecastday: [ForecastDay] }
    let location: Location
    let current: Current
    let forecast: Forecast
}

struct SentinelRadarMetadata: Codable {
    struct Frame: Codable, Identifiable { let id: String; let time: Int; let timestamp: String; let tileTemplate: String; enum CodingKeys: String, CodingKey { case id, time, timestamp, tileTemplate }; var date: Date { Date(timeIntervalSince1970: TimeInterval(time)) } }
    let provider: String
    let attribution: String
    let generatedAt: String
    let tileSize: Int
    let colorScheme: Int
    let smooth: Bool
    let snow: Bool
    let frames: [Frame]
    var sorted: Self { .init(provider: provider, attribution: attribution, generatedAt: generatedAt, tileSize: tileSize, colorScheme: colorScheme, smooth: smooth, snow: snow, frames: frames.sorted { $0.time < $1.time }) }
}

extension SentinelWeather {
    init(weatherAPI response: SentinelWeatherAPIResponse) {
        let hours = response.forecast.forecastday.flatMap(\.hour)
        current = .init(temperature2m: response.current.tempC, apparentTemperature: response.current.feelslikeC, weatherCode: Self.conditionCode(for: response.current.condition.text), windSpeed10m: response.current.windKph)
        hourly = .init(time: hours.map(\.time), temperature2m: hours.map(\.tempC), precipitationProbability: hours.map(\.chanceOfRain))
        daily = .init(time: response.forecast.forecastday.map(\.date), weatherCode: response.forecast.forecastday.map { Self.conditionCode(for: $0.day.condition.text) }, temperature2mMax: response.forecast.forecastday.map(\.day.maxtempC), temperature2mMin: response.forecast.forecastday.map(\.day.mintempC))
    }
}
