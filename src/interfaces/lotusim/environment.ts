export enum WeatherCondition {
  Clear = "CLEAR",
  Cloudy = "CLOUDY",
  Overcast = "OVERCAST",
  LightRain = "LIGHT_RAIN",
  HeavyRain = "HEAVY_RAIN",
  Storm = "STORM",
  Snow = "SNOW",
  Fog = "FOG",
}

export enum WaveSpectrum {
  PM = "PM",
  JONSWAP = "JONSWAP",
}

export interface Atmosphere {
  windSpeed: number;
  windDirection: number;
  temperature: number;
  pressure: number;
  humidity: number;
}

export interface Ocean {
  seaState: number;
  waveHeight: number;
  waveDirection: number;
  wavePeriod: number;
  waveSpectrum: WaveSpectrum;
  currentSpeed: number;
  currentDirection: number;
  waterTemperature: number;
  salinity: number;
}

export interface Visibility {
  horizontal: number;
  vertical: number;
}

export interface Environment {
  atmosphere: Atmosphere;
  ocean: Ocean;
  visibility: Visibility;
  weather: WeatherCondition;
}

export const defaultEnvironment: Environment = {
  atmosphere: {
    windSpeed: 0,
    windDirection: 0,
    temperature: 15,
    pressure: 1013.25,
    humidity: 0.5,
  },
  ocean: {
    seaState: 0,
    waveHeight: 0,
    waveDirection: 0,
    wavePeriod: 0,
    waveSpectrum: WaveSpectrum.PM,
    currentSpeed: 0,
    currentDirection: 0,
    waterTemperature: 20,
    salinity: 35,
  },
  visibility: {
    horizontal: 10000,
    vertical: 10000,
  },
  weather: WeatherCondition.Clear,
};
