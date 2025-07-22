
"use client";
import { DndContext, useSensors, useSensor, PointerSensor, KeyboardSensor, DragStartEvent, DragEndEvent, closestCenter, DragOverlay } from '@dnd-kit/core';
import { useState, useEffect, ComponentType, useCallback } from 'react';
import { DateTimeWidget } from '@/components/dashboard/datetime-widget';
import { NewsWidget } from '@/components/dashboard/news-widget';
import { CalendarWidget } from '@/components/dashboard/calendar-widget';
import { EnvironmentalWidget } from '@/components/dashboard/environmental-widget';
import { AssetTrackerWidget } from '@/components/dashboard/asset-tracker-widget';
import { TaskListWidget } from '@/components/dashboard/task-list-widget';
import { Separator } from '@/components/ui/separator';
import { LifeBuoy, Settings as SettingsIcon, X, Palette as PaletteIcon, PlusCircle, Trash2, Edit3, LinkIcon, Check, XCircle, Palette } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { AccentColorSwitcher } from '@/components/theme/accent-color-switcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SortableContext, sortableKeyboardCoordinates, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SortableWidgetItem } from '@/components/dashboard/sortable-widget-item';
import { Switch } from '@/components/ui/switch';
import type { IcalFeedItem, NewsCategory } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { NewsCategoryWidget } from '@/components/dashboard/news-category-widget';
import { LOCALSTORAGE_KEY_CATEGORIES as NEWS_CATEGORIES_STORAGE_KEY } from '@/components/dashboard/news-widget';


const WIDGET_ORDER_STORAGE_KEY = 'widgetOrder_v3_dynamicNews'; 
const WIDGET_VISIBILITY_STORAGE_KEY = 'widgetVisibility_v3_dynamicNews';
const ICAL_FEEDS_STORAGE_KEY_PAGE = 'pageIcalFeedsLifeOS_v1';

const CALENDAR_WIDGET_ID_PREFIX = 'calendar-feed-';
const NEWS_CATEGORY_WIDGET_ID_PREFIX = 'news-category-';

const MAX_ICAL_FEEDS_PAGE = 10;

interface StaticWidgetConfig {
  id: string;
  Component: ComponentType<any>;
  name: string;
  props?: any;
  columnSpan?: string;
  isDynamic?: false;
}

interface DynamicCalendarFeedWidgetConfig {
  id: string; 
  Component: typeof CalendarWidget;
  name: string; 
  props: { feed: IcalFeedItem };
  columnSpan?: string;
  isDynamic: true;
}

interface DynamicNewsCategoryWidgetConfig {
  id: string; 
  Component: typeof NewsCategoryWidget;
  name: string; 
  props: { category: NewsCategory };
  columnSpan?: string;
  isDynamic: true;
}


type WidgetConfig = StaticWidgetConfig | DynamicCalendarFeedWidgetConfig | DynamicNewsCategoryWidgetConfig;

const initialStaticWidgetConfigs: StaticWidgetConfig[] = [
  { id: 'datetime', name: 'Date and Time', Component: DateTimeWidget, props: {}, columnSpan: 'lg:col-span-1' },
  { id: 'environmental', name: 'Environmental', Component: EnvironmentalWidget, props: {}, columnSpan: 'lg:col-span-1' },
  { id: 'asset-tracker', name: 'Asset Tracker', Component: AssetTrackerWidget, props: {}, columnSpan: 'lg:col-span-1' },
  { id: 'task-list', name: 'Tasks', Component: TaskListWidget, props: {}, columnSpan: 'lg:col-span-1' },
];


const predefinedCalendarColors: { name: string; value: string }[] = [
  { name: 'Red', value: '#F44336' },
  { name: 'Blue', value: '#2196F3' },
  { name: 'Orange', value: '#FF9800' },
  { name: 'Yellow', value: '#FFEB3B' },
  { name: 'Green', value: '#4CAF50' },
  { name: 'Purple', value: '#9C27B0' },
];
let lastAssignedCalendarColorIndex = -1;

const getNextCalendarFeedColor = (): string => {
  lastAssignedCalendarColorIndex = (lastAssignedCalendarColorIndex + 1) % predefinedCalendarColors.length;
  return predefinedCalendarColors[lastAssignedCalendarColorIndex].value;
};
const isValidHexColor = (color: string) => /^#([0-9A-F]{3}){1,2}$/i.test(color);


export default function LifeOSPage() {
  const [showGlobalWidgetSettings, setShowGlobalWidgetSettings] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [openweatherApiKey, setOpenweatherApiKey] = useState('');
  const [weatherapiComKey, setWeatherapiComKey] = useState('');
  const [openuvApiKey, setOpenuvApiKey] = useState('');

  const [icalFeeds, setIcalFeeds] = useState<IcalFeedItem[]>([]);
  const [editingIcalFeed, setEditingIcalFeed] = useState<IcalFeedItem | null>(null);
  const [currentIcalEditData, setCurrentIcalEditData] = useState<{ url: string; label: string; color: string }>({ url: '', label: '', color: getNextCalendarFeedColor() });
  const [newIcalUrl, setNewIcalUrl] = useState('');
  const [newIcalLabel, setNewIcalLabel] = useState('');
  const [newsCategories, setNewsCategories] = useState<NewsCategory[]>([]);


  const allConfigurableWidgets = useCallback((): WidgetConfig[] => {
    const calendarFeedWidgets: DynamicCalendarFeedWidgetConfig[] = icalFeeds.map(feed => ({
      id: `${CALENDAR_WIDGET_ID_PREFIX}${feed.id}`,
      name: feed.label || `Calendar: ${feed.url.substring(0,20)}...`,
      Component: CalendarWidget,
      props: { feed },
      columnSpan: 'lg:col-span-1',
      isDynamic: true,
    }));

    const newsCategoryWidgets: DynamicNewsCategoryWidgetConfig[] = newsCategories.map(category => ({
        id: `${NEWS_CATEGORY_WIDGET_ID_PREFIX}${category.id}`,
        name: `News: ${category.name}`,
        Component: NewsCategoryWidget,
        props: { category },
        columnSpan: 'lg:col-span-1',
        isDynamic: true,
    }));


    return [...initialStaticWidgetConfigs, ...calendarFeedWidgets, ...newsCategoryWidgets];
  }, [icalFeeds, newsCategories]);

  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => allConfigurableWidgets().map(w => w.id));
  const [widgetVisibility, setWidgetVisibility] = useState<Record<string, boolean>>(() => {
    return allConfigurableWidgets().reduce((acc, widget) => ({ ...acc, [widget.id]: true }), {});
  });

  const getWidgetConfigById = (id: string): WidgetConfig | undefined => {
    return allConfigurableWidgets().find(widget => widget.id === id);
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  
  useEffect(() => {
    if (isClient) {
      const savedFeedsString = localStorage.getItem(ICAL_FEEDS_STORAGE_KEY_PAGE);
      if (savedFeedsString) {
        try {
          const parsedFeeds = JSON.parse(savedFeedsString) as IcalFeedItem[];
          setIcalFeeds(parsedFeeds.map(f => ({...f, color: (f.color && isValidHexColor(f.color)) ? f.color : getNextCalendarFeedColor()})));
        } catch (e) {
          console.error("Failed to parse iCal feeds from localStorage", e);
        }
      }

      const savedCategoriesString = localStorage.getItem(NEWS_CATEGORIES_STORAGE_KEY);
      if(savedCategoriesString) {
          try {
            setNewsCategories(JSON.parse(savedCategoriesString));
          } catch(e) {
            console.error("Failed to parse news categories from localStorage", e);
          }
      }

      const savedOpenweatherApiKey = localStorage.getItem('openweather_api_key');
      if (savedOpenweatherApiKey) setOpenweatherApiKey(savedOpenweatherApiKey);

      const savedWeatherapiComKey = localStorage.getItem('weatherapi_com_key');
      if (savedWeatherapiComKey) setWeatherapiComKey(savedWeatherapiComKey);

      const savedOpenuvApiKey = localStorage.getItem('openuv_api_key');
      if (savedOpenuvApiKey) setOpenuvApiKey(savedOpenuvApiKey);
    }
  }, [isClient]);

  useEffect(() => {
      if(isClient) {
          const handleStorageChange = (event: StorageEvent) => {
              if (event.key === NEWS_CATEGORIES_STORAGE_KEY) {
                  try {
                    const newCategories = event.newValue ? JSON.parse(event.newValue) : [];
                    setNewsCategories(newCategories);
                  } catch(e) {
                      console.error("Error updating news categories from storage event", e);
                  }
              }
          };

          window.addEventListener('storage', handleStorageChange);
          return () => window.removeEventListener('storage', handleStorageChange);
      }
  }, [isClient]);


  useEffect(() => {
    if (isClient) {
        try {
            const currentWidgets = allConfigurableWidgets();
            const currentWidgetIds = new Set(currentWidgets.map(w => w.id));

            const savedOrder = localStorage.getItem(WIDGET_ORDER_STORAGE_KEY);
            let order = savedOrder ? JSON.parse(savedOrder) : [];

            const filteredOrder = order.filter((id: string) => currentWidgetIds.has(id));
            const newIds = currentWidgets.map(w => w.id).filter(id => !filteredOrder.includes(id));
            const finalOrder = [...filteredOrder, ...newIds];

            setWidgetOrder(finalOrder);

            const savedVisibility = localStorage.getItem(WIDGET_VISIBILITY_STORAGE_KEY);
            const visibility = savedVisibility ? JSON.parse(savedVisibility) : {};
            const finalVisibility = currentWidgets.reduce((acc, widget) => {
                acc[widget.id] = visibility[widget.id] !== undefined ? visibility[widget.id] : true;
                return acc;
            }, {} as Record<string, boolean>);

            setWidgetVisibility(finalVisibility);

        } catch (e) {
            console.error("Error loading widget layout from localStorage", e);
            setWidgetOrder(allConfigurableWidgets().map(w => w.id));
            setWidgetVisibility(allConfigurableWidgets().reduce((acc, widget) => ({ ...acc, [widget.id]: true }), {}));
        }
    }
  }, [isClient, icalFeeds, newsCategories, allConfigurableWidgets]);


  useEffect(() => {
    if (isClient && icalFeeds.length > 0) { 
      localStorage.setItem(ICAL_FEEDS_STORAGE_KEY_PAGE, JSON.stringify(icalFeeds));
    } else if (isClient && icalFeeds.length === 0) {
       localStorage.removeItem(ICAL_FEEDS_STORAGE_KEY_PAGE);
    }
  }, [icalFeeds, isClient]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem(WIDGET_ORDER_STORAGE_KEY, JSON.stringify(widgetOrder));
    }
  }, [widgetOrder, isClient]);

  useEffect(() => {
    if (isClient && Object.keys(widgetVisibility).length > 0) {
      localStorage.setItem(WIDGET_VISIBILITY_STORAGE_KEY, JSON.stringify(widgetVisibility));
    }
  }, [widgetVisibility, isClient]);

  const handleSaveOpenweatherApiKey = () => {
    if (isClient) {
      localStorage.setItem('openweather_api_key', openweatherApiKey.trim());
      toast({ title: "OpenWeather API Key Saved" });
    }
  };

  const handleSaveWeatherapiComKey = () => {
    if (isClient) {
      localStorage.setItem('weatherapi_com_key', weatherapiComKey.trim());
       toast({ title: "WeatherAPI.com API Key Saved" });
    }
  };

  const handleSaveOpenuvApiKey = () => {
    if (isClient) {
      localStorage.setItem('openuv_api_key', openuvApiKey.trim());
       toast({ title: "OpenUV API Key Saved" });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWidgetOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const handleWidgetVisibilityChange = (id: string, isVisible: boolean) => {
    setWidgetVisibility(prev => ({ ...prev, [id]: isVisible }));
  };

  const dashboardWidgetsToRender = widgetOrder
    .map(id => getWidgetConfigById(id))
    .filter(Boolean)
    .filter(widget => widget && widgetVisibility[widget.id]) as WidgetConfig[];


  const handleAddNewIcalFeed = useCallback(() => {
    if (icalFeeds.length >= MAX_ICAL_FEEDS_PAGE) {
      toast({ title: "Feed Limit Reached", variant: "destructive" });
      return;
    }
    if (!newIcalUrl.trim() || !newIcalUrl.toLowerCase().startsWith('http')) {
      toast({ title: "Invalid URL", variant: "destructive" });
      return;
    }

    const newFeedItem: IcalFeedItem = {
      id: `feed-${Date.now()}`,
      url: newIcalUrl.trim(),
      label: newIcalLabel.trim() || `Calendar Feed ${icalFeeds.length + 1}`,
      color: getNextCalendarFeedColor(),
    };
    setIcalFeeds(prev => [...prev, newFeedItem]);
    setNewIcalUrl('');
    setNewIcalLabel('');
    toast({ title: "Calendar Feed Added" });
  }, [icalFeeds, newIcalUrl, newIcalLabel]);

  const handleRemoveIcalFeed = useCallback((idToRemove: string) => {
    setIcalFeeds(prev => prev.filter(feed => feed.id !== idToRemove));
    const calendarWidgetId = `${CALENDAR_WIDGET_ID_PREFIX}${idToRemove}`;
    setWidgetOrder(prev => prev.filter(id => id !== calendarWidgetId));
  }, []);

  const handleStartEditIcalFeed = useCallback((feed: IcalFeedItem) => {
    setEditingIcalFeed(feed);
    setCurrentIcalEditData({ url: feed.url, label: feed.label, color: feed.color });
  }, []);

  const handleCancelEditIcalFeed = useCallback(() => {
    setEditingIcalFeed(null);
  }, []);

  const handleSaveIcalFeedChanges = useCallback(() => {
    if (!editingIcalFeed) return;
    
    if (currentIcalEditData.color && !isValidHexColor(currentIcalEditData.color)) {
      toast({ title: "Invalid Color", description: "Please enter a valid hex color code (e.g. #RRGGBB).", variant: "destructive" });
      return;
    }

    setIcalFeeds(prevFeeds =>
      prevFeeds.map(f =>
        f.id === editingIcalFeed.id ? { ...f, ...currentIcalEditData } : f
      )
    );
    toast({ title: "Calendar Feed Updated" });
    handleCancelEditIcalFeed();
  }, [editingIcalFeed, currentIcalEditData, handleCancelEditIcalFeed]);


  if (!isClient) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
        <header className="mb-6"><h1 className="text-4xl font-bold">LifeOS</h1></header>
        <div className="text-center p-10">Loading Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <LifeBuoy className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">LifeOS</h1>
            <p className="text-muted-foreground mt-1">Your personal operating system for life.</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
           <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowGlobalWidgetSettings(!showGlobalWidgetSettings)}
          >
            {showGlobalWidgetSettings ? <X className="h-5 w-5" /> : <SettingsIcon className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {showGlobalWidgetSettings && (
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Global Widget Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
                <Label className="text-lg font-semibold mb-3 block">Theme Accent Color</Label>
                <div className="p-4 border rounded-lg bg-muted/30">
                    <AccentColorSwitcher />
                </div>
            </div>
            <Separator/>
            <div>
              <Label className="text-lg font-semibold mb-3 block">Widget Visibility</Label>
              <div className="p-4 border rounded-lg bg-muted/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {allConfigurableWidgets().map(widget => (
                  <div key={`vis-${widget.id}`} className="flex items-center justify-between space-x-2 p-2 rounded-md hover:bg-muted/50">
                    <Label htmlFor={`switch-vis-${widget.id}`} className="text-sm truncate" title={widget.name}>
                      {widget.name}
                    </Label>
                    <Switch
                      id={`switch-vis-${widget.id}`}
                      checked={!!widgetVisibility[widget.id]}
                      onCheckedChange={(checked) => handleWidgetVisibilityChange(widget.id, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <Separator/>
            
            <Accordion type="multiple" className="w-full space-y-4">

              <AccordionItem value="environmental-api-key-settings">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">Environmental API Key Settings</AccordionTrigger>
                <AccordionContent className="p-3 border rounded-lg bg-muted/20 shadow-sm">
                  {/* OpenWeather */}
                  <div className="mb-6">
                    <CardTitle className="text-lg mb-3">OpenWeather API Key</CardTitle>
                    <div className="space-y-1">
                      <Label htmlFor="openweather-api-key">API Key:</Label>
                      <Input id="openweather-api-key" type="text" placeholder="Enter API Key" value={openweatherApiKey} onChange={(e) => setOpenweatherApiKey(e.target.value)} />
                    </div>
                    <Button onClick={handleSaveOpenweatherApiKey} size="sm" className="w-full mt-3">Save Key</Button>
                  </div>
                  <Separator className="my-6" />
                  {/* WeatherAPI.com */}
                  <div className="mb-6">
                    <CardTitle className="text-lg mb-3">WeatherAPI.com API Key</CardTitle>
                    <div className="space-y-1">
                      <Label htmlFor="weatherapi-com-key">API Key:</Label>
                      <Input id="weatherapi-com-key" type="text" placeholder="Enter API Key" value={weatherapiComKey} onChange={(e) => setWeatherapiComKey(e.target.value)} />
                    </div>
                    <Button onClick={handleSaveWeatherapiComKey} size="sm" className="w-full mt-3">Save Key</Button>
                  </div>
                   <Separator className="my-6" />
                  {/* OpenUV */}
                  <div>
                    <CardTitle className="text-lg mb-3">OpenUV API Key</CardTitle>
                    <div className="space-y-1">
                      <Label htmlFor="openuv-api-key">API Key:</Label>
                      <Input id="openuv-api-key" type="text" placeholder="Enter API Key" value={openuvApiKey} onChange={(e) => setOpenuvApiKey(e.target.value)} />
                    </div>
                    <Button onClick={handleSaveOpenuvApiKey} size="sm" className="w-full mt-3">Save Key</Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="calendar-feeds-settings">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">Calendar Feeds Settings</AccordionTrigger>
                <AccordionContent className="p-3 border rounded-lg bg-muted/20 shadow-sm">
                  <CardTitle className="text-lg mb-3">Manage Calendar Feeds</CardTitle>
                  <Card className="p-3 bg-muted/30 rounded-md mb-4">
                      <Label htmlFor="new-ical-label" className="text-xs font-medium">New Feed Label (Optional)</Label>
                      <Input id="new-ical-label" type="text" placeholder="e.g., Work Calendar" value={newIcalLabel} onChange={(e) => setNewIcalLabel(e.target.value)} />
                      <Label htmlFor="new-ical-url" className="text-xs font-medium mt-2 block">iCal Feed URL*</Label>
                      <Input id="new-ical-url" type="url" placeholder="https://example.com/feed.ics" value={newIcalUrl} onChange={(e) => setNewIcalUrl(e.target.value)} required />
                      <Button size="sm" onClick={handleAddNewIcalFeed} disabled={icalFeeds.length >= MAX_ICAL_FEEDS_PAGE} className="w-full mt-3">
                          <PlusCircle className="w-4 h-4 mr-2" /> Add Feed ({icalFeeds.length}/{MAX_ICAL_FEEDS_PAGE})
                      </Button>
                  </Card>
                  {icalFeeds.length > 0 && (
                  <div className="mt-3">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Active Calendar Feeds</h4>
                      <ScrollArea className="pr-1">
                          <div className="space-y-3">
                              {icalFeeds.map((feed) => (
                              <Card key={feed.id} className="p-2.5 shadow-sm border bg-background">
                                  {editingIcalFeed && editingIcalFeed.id === feed.id ? (
                                    <div className="space-y-2">
                                        <Label htmlFor={`edit-ical-label-${feed.id}`} className="text-xs">Label</Label>
                                        <Input id={`edit-ical-label-${feed.id}`} value={currentIcalEditData.label} onChange={(e) => setCurrentIcalEditData(prev => ({...prev, label: e.target.value}))} />
                                        <Label htmlFor={`edit-ical-url-${feed.id}`} className="text-xs">URL</Label>
                                        <Input id={`edit-ical-url-${feed.id}`} type="url" value={currentIcalEditData.url} onChange={(e) => setCurrentIcalEditData(prev => ({...prev, url: e.target.value}))} />
                                        
                                        <div>
                                            <Label className="text-xs flex items-center mb-1.5">
                                                <Palette size={14} className="mr-1.5 text-muted-foreground" /> Feed Color
                                            </Label>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {predefinedCalendarColors.map(colorOption => (
                                                    <button
                                                        key={colorOption.value}
                                                        type="button"
                                                        title={colorOption.name}
                                                        className={cn(
                                                            "w-5 h-5 rounded-full border-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                                                            currentIcalEditData.color === colorOption.value ? "border-foreground" : "border-transparent hover:border-muted-foreground/50"
                                                        )}
                                                        style={{ backgroundColor: colorOption.value }}
                                                        onClick={() => setCurrentIcalEditData(prev => ({...prev, color: colorOption.value}))}
                                                    />
                                                ))}
                                                <Input
                                                    type="text"
                                                    placeholder="#HEX"
                                                    value={currentIcalEditData.color || ''}
                                                    onChange={(e) => setCurrentIcalEditData(prev => ({...prev, color: e.target.value}))}
                                                    className={cn(
                                                        "h-7 w-20 text-xs",
                                                        currentIcalEditData.color && !isValidHexColor(currentIcalEditData.color) && currentIcalEditData.color !== '' ? "border-destructive focus-visible:ring-destructive" : ""
                                                    )}
                                                    maxLength={7}
                                                />
                                            </div>
                                        </div>

                                        <Button onClick={handleSaveIcalFeedChanges} disabled={currentIcalEditData.color !== '' && !isValidHexColor(currentIcalEditData.color)}>Save</Button>
                                        <Button variant="outline" onClick={handleCancelEditIcalFeed}>Cancel</Button>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium" style={{color: feed.color}}>{feed.label}</span>
                                            <div>
                                                <Button variant="ghost" size="icon" onClick={() => handleStartEditIcalFeed(feed)}><Edit3 className="w-3.5 h-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveIcalFeed(feed.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                            </div>
                                        </div>
                                        {/* Conditionally render URL */}                                        {editingIcalFeed?.id === feed.id && (
                                            <span className="text-xs text-muted-foreground truncate">{feed.url}</span>
                                        )}
                                    </div>
                                  )}
                              </Card>
                              ))}
                          </div>
                      </ScrollArea>
                  </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="news-settings">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">News Settings</AccordionTrigger>
                <AccordionContent>
                  <NewsWidget />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="asset-tracker-settings">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">Asset Tracker Settings</AccordionTrigger>
                <AccordionContent>
                  <AssetTrackerWidget settingsOpen={true} displayMode="settingsOnly" />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="task-list-settings">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">Tasks Settings</AccordionTrigger>
                <AccordionContent>
                  <TaskListWidget settingsOpen={true} displayMode="settingsOnly" />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}

      <Separator className="my-6" />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={dashboardWidgetsToRender.map(w => w.id)} strategy={rectSortingStrategy}>
          <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start auto-rows-min">
            {dashboardWidgetsToRender.map((widgetConfig) => {
                const { id, Component, props = {}, columnSpan = 'lg:col-span-1' } = widgetConfig;
                return (
                    <SortableWidgetItem key={id} id={id} isDragging={activeId === id} className={columnSpan}>
                       <Component {...props} />
                    </SortableWidgetItem>
                );
            })}
          </main>
        </SortableContext>
        <DragOverlay>
          {activeId && getWidgetConfigById(activeId) ? (
            <div className="opacity-75 shadow-2xl">
              {(() => {
                const activeWidgetConfig = getWidgetConfigById(activeId);
                if (activeWidgetConfig) {
                  const { Component, props = {} } = activeWidgetConfig;
                  return <Component {...props} />;
                }
                return null;
              })()}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} LifeOS. Minimalist dashboard design.</p>
      </footer>
    </div>
  );
}
