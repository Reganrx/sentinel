import "./WeatherBackground.css";

interface WeatherBackgroundProps {

  condition: string;

}

export default function WeatherBackground({

  condition,

}: WeatherBackgroundProps) {

  const weather =
    condition.toLowerCase();

  let theme = "default";

  if (weather.includes("sun")) {

    theme = "sunny";

  }

  else if (weather.includes("rain")) {

    theme = "rain";

  }

  else if (weather.includes("cloud")) {

    theme = "cloudy";

  }

  else if (weather.includes("snow")) {

    theme = "snow";

  }

  return (

    <div className={`weather-background ${theme}`}>

      <div className="weather-overlay" />

      <div className="weather-glow" />

    </div>

  );

}