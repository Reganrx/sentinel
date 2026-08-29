import "./WeatherIcon.css";

interface WeatherIconProps {

  icon: string;

  condition: string;

  size?: number;

}

export default function WeatherIcon({

  icon,

  condition,

  size = 48,

}: WeatherIconProps) {

  return (

    <img

      className="weather-icon"

      src={`https:${icon}`}

      alt={condition}

      width={size}

      height={size}

      draggable={false}

      loading="lazy"

    />

  );

}