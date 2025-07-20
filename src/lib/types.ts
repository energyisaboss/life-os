
export interface NewsArticle {
  id: string; 
  title?: string;
  link?: string;
  sourceName: string; 
  contentSnippet?: string; 
  isoDate?: string; 
  category?: string; 
  imageUrl?: string; 
}

export interface RssFeedSource {
  id: string;
  url: string;
  userLabel: string;
}

export interface NewsCategory {
  id: string;
  name: string;
  feeds: RssFeedSource[];
  isEditingName?: boolean;
  color: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  calendarSource: string;
  color: string;
  isAllDay?: boolean;
}

export interface IcalFeedItem {
  id: string;
  url: string;
  label: string;
  color: string;
}


export interface EnvironmentalData {
  locationName?: string;
  moonPhase?: {
    name: string; 
    illumination: number; 
    iconName: string; 
  };
  uvIndex?: {
    value: number;
    description: string; 
  };
  airQuality?: {
    aqi: number; 
    level: string; 
    iconName: string; 
    colorClass: string; 
  };
  currentWeather: {
    temp: number;
    description: string;
    iconName: string;
    humidity: number;
    windSpeed: number;
  };
  weeklyWeather: WeatherDay[];
}

export interface WeatherDay {
  day: string;
  iconName: string;
  tempHigh: number;
  tempLow: number;
  rainPercentage: number;
}

export interface Asset {
  id:string;
  name: string;
  symbol: string; 
  quantity: number;
  purchasePrice: number; 
  type: 'stock' | 'fund' | 'crypto'; 
}

export interface AssetHolding extends Asset {
  currentPricePerUnit?: number | null; 
  totalValue: number; 
  profitLoss: number;
}

export interface AssetPortfolio {
  holdings: AssetHolding[];
  totalPortfolioValue: number;
  totalProfitLoss: number;
}
