import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, ScrollView, 
  TouchableOpacity, SafeAreaView, Keyboard, Alert, FlatList,
  Modal, Animated, PanResponder, Dimensions, Platform
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { 
  Wind, Clock, ArrowRightLeft, 
  Play, Square, RotateCcw, Thermometer, Gauge, MapPin, 
  Eye, Cloud, MoveDown, Plane, Search, Home, BookOpen,
  AlertTriangle, BarChart, Calculator, Navigation, 
  Zap, Shield, Calendar, Save, History, Star, 
  Download, Upload, WifiOff, Battery, Users,
  FileText, TrendingUp, Compass, Target, Wind as WindIcon,
  Droplets, Sun, Moon, Thermometer as ThermometerIcon,
  Layers, Map, CheckCircle, XCircle, AlertCircle,
  Feather, Clock as ClockIcon, Shield as ShieldIcon,
  CloudRain, CloudSnow, CloudLightning
} from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

// --- CONFIGURATION ---
const COLORS = {
  bg: '#0F172A',
  card: '#1E293B',
  primary: '#3B82F6',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#8B5CF6',
  text: '#F8FAFC',
  subtext: '#94A3B8',
  border: '#334155',
  vfr: '#10B981',
  mvfr: '#3B82F6',
  ifr: '#F59E0B',
  lifr: '#EF4444'
};

// --- EXTENDED AIRCRAFT DATABASE ---
const AIRCRAFT_DB = [
  { id: 'C152', name: 'Cessna 152', baseDist: 1200, weightFactor: 0.4, vspeeds: { vso: 33, vs: 40, vx: 54, vy: 66, vr: 45, vfe: 85 } },
  { id: 'C172', name: 'Cessna 172 Skyhawk', baseDist: 1335, weightFactor: 0.5, vspeeds: { vso: 33, vs: 44, vx: 62, vy: 74, vr: 55, vfe: 85 } },
  { id: 'C182', name: 'Cessna 182 Skylane', baseDist: 1350, weightFactor: 0.6, vspeeds: { vso: 40, vs: 48, vx: 60, vy: 78, vr: 60, vfe: 110 } },
  { id: 'PA28', name: 'Piper Archer', baseDist: 1390, weightFactor: 0.6, vspeeds: { vso: 44, vs: 51, vx: 66, vy: 79, vr: 55, vfe: 96 } },
  { id: 'SR22', name: 'Cirrus SR22', baseDist: 1178, weightFactor: 0.5, vspeeds: { vso: 61, vs: 70, vx: 80, vy: 101, vr: 70, vfe: 133 } },
];

// --- AIRPORT DATABASE (Sample) ---
const AIRPORT_DB = [
  { id: 'KJFK', name: 'John F Kennedy', city: 'New York', elevation: 13, runways: ['04L/22R', '04R/22L', '13L/31R'] },
  { id: 'KLAX', name: 'Los Angeles Intl', city: 'Los Angeles', elevation: 126, runways: ['06L/24R', '06R/24L', '07L/25R'] },
  { id: 'KORD', name: "O'Hare Intl", city: 'Chicago', elevation: 668, runways: ['04L/22R', '04R/22L', '09L/27R'] },
  { id: 'KSFO', name: 'San Francisco Intl', city: 'San Francisco', elevation: 13, runways: ['01L/19R', '01R/19L', '10L/28R'] },
  { id: 'KDFW', name: 'Dallas/Fort Worth', city: 'Dallas', elevation: 607, runways: ['13L/31R', '13R/31L', '17L/35R'] },
];

// --- EMERGENCY CHECKLISTS ---
const EMERGENCY_CHECKLISTS = {
  engineFailure: [
    "Airspeed - Best Glide (68 KTS)",
    "Fuel Selector - Both",
    "Fuel Pump - ON",
    "Mixture - Rich",
    "Carb Heat - ON",
    "Ignition - Both",
    "Primer - Locked",
    "Landing Site - Identify",
    "Mayday Call - 121.5",
    "Secure Engine",
    "Landing Checklist"
  ],
  fire: [
    "Mixture - Cutoff",
    "Fuel Valve - Off",
    "Master - Off",
    "Cabin Heat - Off",
    "Vents - Close",
    "Extinguisher - Use",
    "Land Immediately"
  ],
  electricalFire: [
    "Master - Off",
    "Avionics - Off",
    "All Electronics - Off",
    "Extinguisher - Use",
    "Land ASAP"
  ]
};

// --- HELPER FUNCTIONS ---
const calculateDensityAltitude = (pressureAlt: number, temp: number) => {
  return pressureAlt + 118.8 * (temp - 15);
};

const calculateWeightBalance = (weight: number, moment: number, arm: number) => {
  const newMoment = moment + (weight * arm);
  const newWeight = weight;
  const newArm = newMoment / newWeight;
  return { weight: newWeight, moment: newMoment, arm: newArm };
};

const calculateGlideDistance = (altitude: number, glideRatio: number) => {
  return (altitude * glideRatio) / 6076; // Convert to nautical miles
};

// --- ADVANCED METAR PARSER ---
const parseMETAR = (input: string) => {
  const cleanInput = input.toUpperCase().trim();
  const stationMatch = cleanInput.match(/^[A-Z]{4}/);
  const windMatch = cleanInput.match(/(\d{3}|VRB)(\d{2,3})(G\d{2,3})?KT/);
  const visMatch = cleanInput.match(/(\d{1,2}|M?\d\/\d)SM/);
  const cloudMatch = cleanInput.match(/(FEW|SCT|BKN|OVC|VV)(\d{3})/g);
  const tdMatch = cleanInput.match(/ (M?\d{2})\/(M?\d{2}) /);
  const altMatch = cleanInput.match(/ A(\d{4})/);

  const temp = tdMatch ? parseInt(tdMatch[1].replace('M', '-')) : 15;
  const alt = altMatch ? parseInt(altMatch[1]) / 100 : 29.92;

  let category = 'VFR';
  const visValue = visMatch ? visMatch[1] : '10';
  const visNum = parseFloat(visValue.replace('M', ''));
  
  let cloudCeil = 10000;
  if (cloudMatch) {
    const cloudLayers = cloudMatch.map(layer => {
      const match = layer.match(/(FEW|SCT|BKN|OVC|VV)(\d{3})/);
      return match ? { type: match[1], height: parseInt(match[2]) * 100 } : null;
    }).filter(Boolean);
    
    const lowestOvercast = cloudLayers.find(l => l.type === 'BKN' || l.type === 'OVC');
    cloudCeil = lowestOvercast ? lowestOvercast.height : 10000;
  }

  if (visNum < 3 || cloudCeil < 1000) category = 'IFR';
  if (visNum < 1 || cloudCeil < 500) category = 'LIFR';

  return {
    station: stationMatch ? stationMatch[0] : '---',
    windDir: windMatch ? windMatch[1] : '---',
    windSpeed: windMatch ? windMatch[2] : '0',
    gust: windMatch && windMatch[3] ? windMatch[3].replace('G', '') : null,
    visibility: visValue,
    clouds: cloudMatch ? cloudMatch.join(', ') : 'Clear',
    temperature: temp,
    dewpoint: tdMatch ? parseInt(tdMatch[2].replace('M', '-')) : null,
    altimeter: alt,
    category,
    cloudCeil,
    raw: cleanInput
  };
};

// --- COMPONENTS ---
const MenuButton = ({ title, subtitle, icon: Icon, color, onPress }: any) => (
  <TouchableOpacity style={styles.menuCard} onPress={onPress}>
    <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
      <Icon color={color} size={24} />
    </View>
    <Text style={styles.menuTitle}>{title}</Text>
    <Text style={styles.menuSub}>{subtitle}</Text>
  </TouchableOpacity>
);

const ResultTile = ({ label, val, icon: Icon, color = 'white' }: any) => (
  <View style={styles.resBox}>
    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 5}}>
      <Icon size={12} color={COLORS.subtext} style={{marginRight: 5}} />
      <Text style={styles.label}>{label}</Text>
    </View>
    <Text style={[styles.resVal, { color }]}>{val}</Text>
  </View>
);

const ChecklistItem = ({ item, index, checked, onToggle }: any) => (
  <TouchableOpacity 
    style={[styles.checklistItem, checked && styles.checklistItemChecked]}
    onPress={() => onToggle(index)}
  >
    <View style={styles.checklistNumber}>
      <Text style={styles.checklistNumberText}>{index + 1}</Text>
    </View>
    <Text style={[styles.checklistText, checked && styles.checklistTextChecked]}>
      {item}
    </Text>
    {checked ? (
      <CheckCircle size={20} color={COLORS.success} />
    ) : (
      <AlertCircle size={20} color={COLORS.subtext} />
    )}
  </TouchableOpacity>
);

// --- SCREENS ---

function HomeScreen({ navigation }: any) {
  const [location, setLocation] = useState<any>(null);
  const [nearestAirports, setNearestAirports] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
      
      // Find nearest airports (simplified)
      const nearby = AIRPORT_DB.slice(0, 3).map(airport => ({
        ...airport,
        distance: Math.random() * 50 + 10 // Simulated distance
      }));
      setNearestAirports(nearby);
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.brand}>FLIGHT DECK <Text style={{color: COLORS.primary}}>PRO</Text></Text>
          <Text style={styles.subtitle}>Comprehensive Aviation Assistant</Text>
        </View>

        {location && (
          <View style={styles.locationCard}>
            <MapPin size={16} color={COLORS.primary} />
            <Text style={styles.locationText}>
              Position: {location.coords.latitude.toFixed(4)}°, {location.coords.longitude.toFixed(4)}°
            </Text>
          </View>
        )}

        {/* Quick Stats section removed here */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>TOOLS</Text>
        </View>
        <View style={styles.menuGrid}>
          <MenuButton title="WEATHER" subtitle="METAR/TAF" icon={Cloud} color={COLORS.primary} onPress={() => navigation.navigate('Weather')} />
          <MenuButton title="PERFORMANCE" subtitle="Takeoff/Landing" icon={Plane} color={COLORS.success} onPress={() => navigation.navigate('Performance')} />
          <MenuButton title="WEIGHT & BALANCE" subtitle="CG Calculator" icon={BarChart} color="#EC4899" onPress={() => navigation.navigate('WeightBalance')} />
          <MenuButton title="NAVIGATION" subtitle="Flight Planning" icon={Navigation} color="#8B5CF6" onPress={() => navigation.navigate('Navigation')} />
          <MenuButton title="EMERGENCY" subtitle="Checklists" icon={AlertTriangle} color={COLORS.danger} onPress={() => navigation.navigate('Emergency')} />
          <MenuButton title="CALCULATORS" subtitle="Various Tools" icon={Calculator} color={COLORS.warning} onPress={() => navigation.navigate('Calculators')} />
        </View>

        {nearestAirports.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>NEAREST AIRPORTS</Text>
            </View>
            <View style={styles.airportList}>
              {nearestAirports.map((airport, index) => (
                <TouchableOpacity key={index} style={styles.airportCard}>
                  <View style={styles.airportHeader}>
                    <Text style={styles.airportCode}>{airport.id}</Text>
                    <Text style={styles.airportDistance}>{airport.distance.toFixed(1)} NM</Text>
                  </View>
                  <Text style={styles.airportName}>{airport.name}</Text>
                  <Text style={styles.airportCity}>{airport.city}</Text>
                  <View style={styles.runwayContainer}>
                    {airport.runways.slice(0, 2).map((rw: string, i: number) => (
                      <View key={i} style={styles.runwayTag}>
                        <Text style={styles.runwayText}>{rw}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function WeatherScreen() {
  const [metarInput, setMetarInput] = useState('');
  const [parsed, setParsed] = useState<any>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showTAF, setShowTAF] = useState(false);

  const handleParse = () => {
    if (!metarInput.trim()) return;
    const result = parseMETAR(metarInput);
    setParsed(result);
    Keyboard.dismiss();
  };

  const getCategoryColor = (category: string) => {
    switch(category) {
      case 'VFR': return COLORS.vfr;
      case 'MVFR': return COLORS.mvfr;
      case 'IFR': return COLORS.ifr;
      case 'LIFR': return COLORS.lifr;
      default: return COLORS.text;
    }
  };

  return (
    <ScrollView style={styles.subPage}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>METAR ANALYSIS</Text>
          <TouchableOpacity onPress={() => setShowTAF(!showTAF)}>
            <Text style={styles.linkText}>{showTAF ? 'Show METAR' : 'Show TAF'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>ENTER METAR/TAF</Text>
        <TextInput 
          style={[styles.input, { minHeight: 80 }]} 
          placeholder="KJFK 121530Z 19012G20KT 10SM FEW030 BKN100 25/18 A2992..." 
          placeholderTextColor={COLORS.subtext}
          value={metarInput}
          onChangeText={setMetarInput}
          multiline
        />
        
        <TouchableOpacity style={styles.mainBtn} onPress={handleParse}>
          <Text style={styles.btnText}>ANALYZE WEATHER</Text>
        </TouchableOpacity>
      </View>

      {parsed && (
        <View style={styles.resContainer}>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(parsed.category) }]}>
            <Text style={styles.categoryText}>{parsed.category} CONDITIONS</Text>
          </View>

          <View style={styles.weatherGrid}>
            <View style={styles.weatherCard}>
              <MapPin size={20} color={COLORS.subtext} />
              <Text style={styles.weatherLabel}>STATION</Text>
              <Text style={styles.weatherValue}>{parsed.station}</Text>
            </View>
            
            <View style={styles.weatherCard}>
              <Wind size={20} color={COLORS.subtext} />
              <Text style={styles.weatherLabel}>WIND</Text>
              <Text style={styles.weatherValue}>
                {parsed.windDir}° @ {parsed.windSpeed}KT
                {parsed.gust && ` G${parsed.gust}KT`}
              </Text>
            </View>

            <View style={styles.weatherCard}>
              <Eye size={20} color={COLORS.subtext} />
              <Text style={styles.weatherLabel}>VISIBILITY</Text>
              <Text style={styles.weatherValue}>{parsed.visibility} SM</Text>
            </View>

            <View style={styles.weatherCard}>
              <Cloud size={20} color={COLORS.subtext} />
              <Text style={styles.weatherLabel}>CEILING</Text>
              <Text style={styles.weatherValue}>{parsed.cloudCeil} FT</Text>
            </View>

            <View style={styles.weatherCard}>
              <ThermometerIcon size={20} color={COLORS.subtext} />
              <Text style={styles.weatherLabel}>TEMP/DEW</Text>
              <Text style={styles.weatherValue}>
                {parsed.temperature}°C / {parsed.dewpoint}°C
              </Text>
            </View>

            <View style={styles.weatherCard}>
              <Gauge size={20} color={COLORS.subtext} />
              <Text style={styles.weatherLabel}>ALTIMETER</Text>
              <Text style={styles.weatherValue}>{parsed.altimeter}" Hg</Text>
            </View>
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.label}>CLOUD LAYERS</Text>
            <Text style={styles.detailText}>{parsed.clouds || 'Clear skies'}</Text>
            
            <Text style={[styles.label, { marginTop: 15 }]}>RAW METAR</Text>
            <Text style={styles.detailText}>{parsed.raw}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function PerformanceScreen() {
  const [selectedAc, setSelectedAc] = useState(AIRCRAFT_DB[1]);
  const [weight, setWeight] = useState('2400');
  const [temp, setTemp] = useState('20');
  const [pressureAlt, setPressureAlt] = useState('1000');
  const [headwind, setHeadwind] = useState('10');
  const [slope, setSlope] = useState('0');
  const [surface, setSurface] = useState('paved');
  const [showDensityAlt, setShowDensityAlt] = useState(false);

  const densityAltitude = calculateDensityAltitude(
    parseFloat(pressureAlt) || 0,
    parseFloat(temp) || 15
  );

  const calculateTakeoffDistance = () => {
    let dist = selectedAc.baseDist;
    const weightDiff = (parseFloat(weight) || 0) - 2000;
    dist += weightDiff * selectedAc.weightFactor;
    
    // Temperature effect
    dist *= (1 + ((parseFloat(temp) || 15) - 15) * 0.01);
    
    // Pressure altitude effect
    dist *= (1 + (parseFloat(pressureAlt) || 0) * 0.0001);
    
    // Headwind effect
    const windEffect = 1 - ((parseFloat(headwind) || 0) * 0.05);
    dist *= Math.max(windEffect, 0.7);
    
    // Surface effect
    if (surface === 'grass') dist *= 1.15;
    if (surface === 'soft') dist *= 1.25;
    
    // Slope effect
    const slopeEffect = 1 + (parseFloat(slope) || 0) * 0.02;
    dist *= slopeEffect;
    
    return Math.round(dist);
  };

  const calculateLandingDistance = () => {
    let dist = calculateTakeoffDistance() * 0.8;
    return Math.round(dist);
  };

  return (
    <ScrollView style={styles.subPage}>
      <View style={styles.card}>
        <Text style={styles.label}>AIRCRAFT MODEL</Text>
        <ScrollView horizontal style={styles.acSelector}>
          {AIRCRAFT_DB.map(ac => (
            <TouchableOpacity 
              key={ac.id}
              style={[styles.acButton, selectedAc.id === ac.id && styles.acButtonActive]}
              onPress={() => setSelectedAc(ac)}
            >
              <Text style={[styles.acButtonText, selectedAc.id === ac.id && styles.acButtonTextActive]}>
                {ac.id}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <Text style={styles.acName}>{selectedAc.name}</Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>WEIGHT (LBS)</Text>
            <TextInput 
              style={styles.input}
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>TEMP (°C)</Text>
            <TextInput 
              style={styles.input}
              keyboardType="numeric"
              value={temp}
              onChangeText={setTemp}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>PRESSURE ALT (FT)</Text>
            <TextInput 
              style={styles.input}
              keyboardType="numeric"
              value={pressureAlt}
              onChangeText={setPressureAlt}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>HEADWIND (KTS)</Text>
            <TextInput 
              style={styles.input}
              keyboardType="numeric"
              value={headwind}
              onChangeText={setHeadwind}
            />
          </View>
        </View>

        <Text style={styles.label}>RUNWAY SURFACE</Text>
        <View style={styles.surfaceSelector}>
          {['paved', 'grass', 'soft'].map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.surfaceButton, surface === type && styles.surfaceButtonActive]}
              onPress={() => setSurface(type)}
            >
              <Text style={[styles.surfaceText, surface === type && styles.surfaceTextActive]}>
                {type.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>RUNWAY SLOPE (%)</Text>
        <TextInput 
          style={styles.input}
          keyboardType="numeric"
          value={slope}
          onChangeText={setSlope}
          placeholder="Positive for uphill"
        />
      </View>

      <TouchableOpacity 
        style={styles.toggleCard}
        onPress={() => setShowDensityAlt(!showDensityAlt)}
      >
        <Text style={styles.toggleText}>
          {showDensityAlt ? '▼' : '▶'} DENSITY ALTITUDE CALCULATION
        </Text>
      </TouchableOpacity>

      {showDensityAlt && (
        <View style={styles.card}>
          <Text style={styles.label}>DENSITY ALTITUDE</Text>
          <Text style={styles.resValLarge}>{Math.round(densityAltitude)} FT</Text>
          <Text style={styles.smallText}>
            Pressure Alt: {pressureAlt || 0} FT • Temp: {temp || 15}°C
          </Text>
        </View>
      )}

      <View style={styles.resContainer}>
        <View style={styles.perfGrid}>
          <View style={styles.perfCard}>
            <Text style={styles.perfLabel}>TAKEOFF DISTANCE</Text>
            <Text style={styles.perfValue}>{calculateTakeoffDistance()} FT</Text>
            <Text style={styles.perfSub}>Ground Roll</Text>
          </View>
          
          <View style={styles.perfCard}>
            <Text style={styles.perfLabel}>LANDING DISTANCE</Text>
            <Text style={styles.perfValue}>{calculateLandingDistance()} FT</Text>
            <Text style={styles.perfSub}>Over 50ft obstacle</Text>
          </View>
        </View>

        <View style={styles.safetyCard}>
          <Text style={styles.safetyLabel}>SAFE RUNWAY REQUIRED</Text>
          <Text style={styles.safetyValue}>
            {Math.round(calculateTakeoffDistance() * 1.67)} FT
          </Text>
          <Text style={styles.safetySub}>(1.67x Safety Factor)</Text>
        </View>

        <View style={styles.vspeedCard}>
          <Text style={styles.label}>V-SPEEDS FOR {selectedAc.id}</Text>
          <View style={styles.vspeedGrid}>
            {Object.entries(selectedAc.vspeeds).map(([key, value]) => (
              <View key={key} style={styles.vspeedItem}>
                <Text style={styles.vspeedLabel}>{key.toUpperCase()}</Text>
                <Text style={styles.vspeedValue}>{value} KTS</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function WeightBalanceScreen() {
  const [selectedAc, setSelectedAc] = useState(AIRCRAFT_DB[1]);
  const [stations, setStations] = useState([
    { name: 'Pilot', weight: '170', arm: 37 },
    { name: 'Co-pilot', weight: '170', arm: 37 },
    { name: 'Front Pass', weight: '0', arm: 37 },
    { name: 'Rear Pass', weight: '0', arm: 73 },
    { name: 'Fuel', weight: '360', arm: 48 },
    { name: 'Baggage', weight: '50', arm: 95 },
  ]);

  const updateWeight = (index: number, weight: string) => {
    const newStations = [...stations];
    newStations[index].weight = weight;
    setStations(newStations);
  };

  const calculateTotals = () => {
    let totalWeight = 0;
    let totalMoment = 0;
    
    stations.forEach(station => {
      const weight = parseFloat(station.weight) || 0;
      totalWeight += weight;
      totalMoment += weight * station.arm;
    });
    
    const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;
    
    return { totalWeight, totalMoment, cg };
  };

  const { totalWeight, totalMoment, cg } = calculateTotals();
  const cgPercent = ((cg - 35) / (45 - 35)) * 100; // Simplified MAC calculation
  const isInEnvelope = cg >= 35 && cg <= 45 && totalWeight <= 2550;

  return (
    <ScrollView style={styles.subPage}>
      <View style={styles.card}>
        <Text style={styles.label}>AIRCRAFT SELECTED</Text>
        <ScrollView horizontal style={styles.acSelector}>
          {AIRCRAFT_DB.map(ac => (
            <TouchableOpacity 
              key={ac.id}
              style={[styles.acButton, selectedAc.id === ac.id && styles.acButtonActive]}
              onPress={() => setSelectedAc(ac)}
            >
              <Text style={[styles.acButtonText, selectedAc.id === ac.id && styles.acButtonTextActive]}>
                {ac.id}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>LOADING STATIONS</Text>
        {stations.map((station, index) => (
          <View key={index} style={styles.stationRow}>
            <View style={styles.stationInfo}>
              <Text style={styles.stationName}>{station.name}</Text>
              <Text style={styles.stationArm}>ARM: {station.arm}"</Text>
            </View>
            <TextInput
              style={styles.stationInput}
              keyboardType="numeric"
              value={station.weight}
              onChangeText={(text) => updateWeight(index, text)}
              placeholder="Weight"
            />
            <Text style={styles.stationUnit}>LBS</Text>
          </View>
        ))}
      </View>

      <View style={styles.envelopeContainer}>
        <Text style={styles.label}>CENTER OF GRAVITY ENVELOPE</Text>
        <View style={styles.envelope}>
          <View style={[styles.cgMarker, { left: `${Math.min(Math.max(cgPercent, 0), 100)}%` }]}>
            <View style={styles.cgDot} />
            <Text style={styles.cgText}>{cg.toFixed(1)}"</Text>
          </View>
          <View style={styles.envelopeBounds}>
            <View style={styles.envelopeLimit}>
              <Text style={styles.limitText}>FWD LIMIT</Text>
              <Text style={styles.limitValue}>35"</Text>
            </View>
            <View style={styles.envelopeArea} />
            <View style={styles.envelopeLimit}>
              <Text style={styles.limitText}>AFT LIMIT</Text>
              <Text style={styles.limitValue}>45"</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>TOTAL WEIGHT</Text>
          <Text style={styles.summaryValue}>{totalWeight.toFixed(0)} LBS</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>TOTAL MOMENT</Text>
          <Text style={styles.summaryValue}>{totalMoment.toFixed(0)} LB-IN</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>CENTER OF GRAVITY</Text>
          <Text style={[styles.summaryValue, { color: isInEnvelope ? COLORS.success : COLORS.danger }]}>
            {cg.toFixed(1)}"
          </Text>
        </View>
        
        <View style={[styles.statusBadge, { backgroundColor: isInEnvelope ? COLORS.success + '20' : COLORS.danger + '20' }]}>
          {isInEnvelope ? (
            <CheckCircle size={20} color={COLORS.success} />
          ) : (
            <XCircle size={20} color={COLORS.danger} />
          )}
          <Text style={[styles.statusText, { color: isInEnvelope ? COLORS.success : COLORS.danger }]}>
            {isInEnvelope ? 'WITHIN ENVELOPE' : 'OUTSIDE ENVELOPE'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function NavigationScreen() {
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [cruiseSpeed, setCruiseSpeed] = useState('120');
  const [fuelBurn, setFuelBurn] = useState('8.5');
  const [results, setResults] = useState<any>(null);

  const calculateFlight = () => {
    // Simplified calculation - in real app, use actual distances
    const distance = 250; // NM
    const ete = (distance / parseFloat(cruiseSpeed || 120)) * 60;
    const fuelRequired = (ete / 60) * parseFloat(fuelBurn || 8.5);
    
    setResults({
      distance: distance,
      ete: Math.round(ete),
      fuel: Math.round(fuelRequired * 1.3), // With reserves
      cruiseAlt: '8000',
      route: 'DIRECT'
    });
  };

  return (
    <ScrollView style={styles.subPage}>
      <View style={styles.card}>
        <Text style={styles.label}>FLIGHT PLANNING</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.subLabel}>DEPARTURE</Text>
          <TextInput 
            style={styles.input}
            value={departure}
            onChangeText={setDeparture}
            placeholder="KXXX"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.subLabel}>DESTINATION</Text>
          <TextInput 
            style={styles.input}
            value={destination}
            onChangeText={setDestination}
            placeholder="KXXX"
          />
        </View>

        <View style={styles.paramGrid}>
          <View style={styles.paramGroup}>
            <Text style={styles.subLabel}>CRUISE SPEED</Text>
            <TextInput 
              style={styles.input}
              keyboardType="numeric"
              value={cruiseSpeed}
              onChangeText={setCruiseSpeed}
            />
            <Text style={styles.paramUnit}>KTS</Text>
          </View>
          
          <View style={styles.paramGroup}>
            <Text style={styles.subLabel}>FUEL BURN</Text>
            <TextInput 
              style={styles.input}
              keyboardType="numeric"
              value={fuelBurn}
              onChangeText={setFuelBurn}
            />
            <Text style={styles.paramUnit}>GPH</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.mainBtn} onPress={calculateFlight}>
          <Text style={styles.btnText}>CALCULATE FLIGHT PLAN</Text>
        </TouchableOpacity>
      </View>

      {results && (
        <View style={styles.resContainer}>
          <View style={styles.navGrid}>
            <View style={styles.navCard}>
              <Text style={styles.navLabel}>DISTANCE</Text>
              <Text style={styles.navValue}>{results.distance}</Text>
              <Text style={styles.navUnit}>NM</Text>
            </View>
            
            <View style={styles.navCard}>
              <Text style={styles.navLabel}>EST TIME</Text>
              <Text style={styles.navValue}>{results.ete}</Text>
              <Text style={styles.navUnit}>MIN</Text>
            </View>
            
            <View style={styles.navCard}>
              <Text style={styles.navLabel}>FUEL REQ'D</Text>
              <Text style={styles.navValue}>{results.fuel}</Text>
              <Text style={styles.navUnit}>GAL</Text>
            </View>
            
            <View style={styles.navCard}>
              <Text style={styles.navLabel}>CRUISE ALT</Text>
              <Text style={styles.navValue}>{results.cruiseAlt}</Text>
              <Text style={styles.navUnit}>FT</Text>
            </View>
          </View>

          <View style={styles.routeCard}>
            <Text style={styles.label}>ROUTE</Text>
            <Text style={styles.routeText}>{results.route}</Text>
          </View>

          <View style={styles.checklistCard}>
            <Text style={styles.label}>PRE-FLIGHT CHECKLIST</Text>
            {[
              'Weather briefing complete',
              'NOTAMs reviewed',
              'Weight & balance within limits',
              'Fuel adequate + reserves',
              'Alternate airport selected',
              'Flight plan filed'
            ].map((item, index) => (
              <View key={index} style={styles.checkItem}>
                <CheckCircle size={16} color={COLORS.success} />
                <Text style={styles.checkText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function EmergencyScreen() {
  const [selectedChecklist, setSelectedChecklist] = useState('engineFailure');
  const [checkedItems, setCheckedItems] = useState<number[]>([]);
  const [emergencyDeclared, setEmergencyDeclared] = useState(false);
  const [showMayday, setShowMayday] = useState(false);

  const handleToggleItem = (index: number) => {
    if (checkedItems.includes(index)) {
      setCheckedItems(checkedItems.filter(i => i !== index));
    } else {
      setCheckedItems([...checkedItems, index]);
    }
  };

  const resetChecklist = () => {
    setCheckedItems([]);
    setEmergencyDeclared(false);
    setShowMayday(false);
  };

  const declareEmergency = () => {
    setEmergencyDeclared(true);
    setShowMayday(true);
    Alert.alert(
      'EMERGENCY DECLARED',
      'Transponder: 7700\nFrequency: 121.5 MHz\nState: Nature of emergency, intentions, position, altitude',
      [{ text: 'ROGER' }]
    );
  };

  return (
    <ScrollView style={styles.subPage}>
      {showMayday && (
        <View style={styles.emergencyBanner}>
          <AlertTriangle size={24} color={COLORS.danger} />
          <Text style={styles.emergencyText}>MAYDAY MAYDAY MAYDAY</Text>
          <AlertTriangle size={24} color={COLORS.danger} />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>SELECT EMERGENCY</Text>
        <View style={styles.emergencySelector}>
          {Object.keys(EMERGENCY_CHECKLISTS).map(key => (
            <TouchableOpacity
              key={key}
              style={[styles.emergencyButton, selectedChecklist === key && styles.emergencyButtonActive]}
              onPress={() => {
                setSelectedChecklist(key);
                setCheckedItems([]);
              }}
            >
              <Text style={[styles.emergencyButtonText, selectedChecklist === key && styles.emergencyButtonTextActive]}>
                {key.replace(/([A-Z])/g, ' $1').toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.checklistContainer}>
          {(EMERGENCY_CHECKLISTS as any)[selectedChecklist].map((item: string, index: number) => (
            <ChecklistItem
              key={index}
              item={item}
              index={index}
              checked={checkedItems.includes(index)}
              onToggle={handleToggleItem}
            />
          ))}
        </View>

        <View style={styles.emergencyActions}>
          <TouchableOpacity 
            style={[styles.emergencyActionBtn, { backgroundColor: COLORS.danger }]}
            onPress={declareEmergency}
          >
            <Text style={styles.emergencyActionText}>DECLARE EMERGENCY</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.emergencyActionBtn, { backgroundColor: COLORS.card }]}
            onPress={resetChecklist}
          >
            <Text style={[styles.emergencyActionText, { color: COLORS.text }]}>RESET</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>GLIDE DISTANCE CALCULATOR</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.subLabel}>ALTITUDE (FT)</Text>
          <TextInput 
            style={styles.input}
            keyboardType="numeric"
            placeholder="5000"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.subLabel}>GLIDE RATIO</Text>
          <TextInput 
            style={styles.input}
            keyboardType="numeric"
            placeholder="9"
          />
        </View>
        <TouchableOpacity style={styles.secondaryBtn}>
          <Text style={styles.btnText}>CALCULATE GLIDE RANGE</Text>
        </TouchableOpacity>
        <Text style={styles.resultText}>Estimated range: 7.4 NM</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>EMERGENCY FREQUENCIES</Text>
        {[
          { freq: '121.50', name: 'VHF Guard', use: 'Emergency/Military' },
          { freq: '243.00', name: 'UHF Guard', use: 'Emergency/Military' },
          { freq: '121.55', name: 'Company Ops', use: 'Airline Operations' },
          { freq: '122.75', name: 'Enroute Flight Advisory', use: 'Flight Service' },
        ].map((freq, index) => (
          <View key={index} style={styles.freqItem}>
            <Text style={styles.freqValue}>{freq.freq} MHz</Text>
            <Text style={styles.freqName}>{freq.name}</Text>
            <Text style={styles.freqUse}>{freq.use}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function CalculatorsScreen() {
  const [calcMode, setCalcMode] = useState<'temp' | 'wind' | 'time' | 'fuel'>('wind');
  const [input1, setInput1] = useState('');
  const [input2, setInput2] = useState('');
  const [result, setResult] = useState<number | null>(null);

  const calculate = () => {
    const val1 = parseFloat(input1) || 0;
    const val2 = parseFloat(input2) || 0;
    
    switch(calcMode) {
      case 'wind':
        // Wind correction angle
        const wca = Math.asin(val2 * Math.sin(val1 * Math.PI/180) / 100) * 180/Math.PI;
        setResult(wca);
        break;
      case 'temp':
        // Density altitude
        setResult(val1 + 118.8 * (val2 - 15));
        break;
      case 'time':
        // ETE
        setResult((val1 / val2) * 60);
        break;
      case 'fuel':
        // Fuel required
        setResult(val1 * val2 * 1.3);
        break;
    }
  };

  const getInputLabels = () => {
    switch(calcMode) {
      case 'wind': return ['Wind Angle (°)', 'Wind Speed (KTS)'];
      case 'temp': return ['Pressure Alt (FT)', 'Temperature (°C)'];
      case 'time': return ['Distance (NM)', 'Ground Speed (KTS)'];
      case 'fuel': return ['ETE (HRS)', 'Fuel Burn (GPH)'];
    }
  };

  const getResultLabel = () => {
    switch(calcMode) {
      case 'wind': return 'Wind Correction Angle';
      case 'temp': return 'Density Altitude';
      case 'time': return 'Estimated Time Enroute';
      case 'fuel': return 'Fuel Required';
    }
  };

  const getResultUnit = () => {
    switch(calcMode) {
      case 'wind': return '°';
      case 'temp': return 'FT';
      case 'time': return 'MIN';
      case 'fuel': return 'GAL';
    }
  };

  return (
    <View style={styles.subPage}>
      <ScrollView>
        <View style={styles.calcHeader}>
          {[
            { key: 'wind', icon: WindIcon, label: 'WIND' },
            { key: 'temp', icon: ThermometerIcon, label: 'DENSITY' },
            { key: 'time', icon: ClockIcon, label: 'TIME' },
            { key: 'fuel', icon: Droplets, label: 'FUEL' },
          ].map(({ key, icon: Icon, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.calcTab, calcMode === key && styles.calcTabActive]}
              onPress={() => setCalcMode(key as any)}
            >
              <Icon size={20} color={calcMode === key ? COLORS.primary : COLORS.subtext} />
              <Text style={[styles.calcTabText, calcMode === key && styles.calcTabTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{getInputLabels()[0]}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={input1}
            onChangeText={setInput1}
          />
          
          <Text style={styles.label}>{getInputLabels()[1]}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={input2}
            onChangeText={setInput2}
          />
          
          <TouchableOpacity style={styles.mainBtn} onPress={calculate}>
            <Text style={styles.btnText}>CALCULATE</Text>
          </TouchableOpacity>
        </View>

        {result !== null && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>{getResultLabel()}</Text>
            <Text style={styles.resultValue}>
              {result.toFixed(1)} <Text style={styles.resultUnit}>{getResultUnit()}</Text>
            </Text>
          </View>
        )}

        <View style={styles.tipsCard}>
          <Text style={styles.label}>QUICK REFERENCE</Text>
          {[
            'Standard Rate Turn: Bank Angle = (TAS / 10) + 5',
            'Descent Planning: 3:1 Rule (3 NM per 1000 FT)',
            'VFR Fuel Minimums: Day 30min, Night 45min',
            'Holding Pattern: 1min legs below 14000ft',
            'Alternate Requirements: 1-2-3 Rule (IFR)'
          ].map((tip, index) => (
            <Text key={index} style={styles.tipText}>• {tip}</Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// --- TAB NAVIGATOR ---
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let Icon = Home;
          switch (route.name) {
            case 'Home': Icon = Home; break;
            case 'Weather': Icon = Cloud; break;
            case 'Performance': Icon = Plane; break;
            case 'Navigation': Icon = Navigation; break;
            case 'Calculators': Icon = Calculator; break;
          }
          return <Icon size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.subtext,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
        },
        headerStyle: {
          backgroundColor: COLORS.bg,
        },
        headerTintColor: COLORS.text,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Weather" component={WeatherScreen} options={{ title: 'Weather' }} />
      <Tab.Screen name="Performance" component={PerformanceScreen} options={{ title: 'Performance' }} />
      <Tab.Screen name="Navigation" component={NavigationScreen} options={{ title: 'Navigation' }} />
      <Tab.Screen name="Calculators" component={CalculatorsScreen} options={{ title: 'Calculators' }} />
    </Tab.Navigator>
  );
}

// --- STACK NAVIGATOR ---
const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{
        headerStyle: { backgroundColor: COLORS.bg, elevation: 0 },
        headerTintColor: 'white',
        headerTitleStyle: { fontWeight: '800' }
      }}>
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="WeightBalance" component={WeightBalanceScreen} options={{ title: 'Weight & Balance' }} />
        <Stack.Screen name="Emergency" component={EmergencyScreen} options={{ title: 'Emergency Procedures' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 25, paddingTop: 40 },
  brand: { color: 'white', fontSize: 26, fontWeight: '900' },
  subtitle: { color: COLORS.subtext, fontSize: 12, marginTop: 4 },
  locationCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.card, 
    marginHorizontal: 20, 
    padding: 15, 
    borderRadius: 12,
    marginBottom: 20
  },
  locationText: { color: COLORS.primary, marginLeft: 10, fontSize: 12 },
  quickStats: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginHorizontal: 20, 
    marginBottom: 25 
  },
  statBox: { alignItems: 'center' },
  statValue: { color: 'white', fontSize: 24, fontWeight: '900' },
  statLabel: { color: COLORS.subtext, fontSize: 10, marginTop: 4 },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginHorizontal: 20, 
    marginBottom: 15 
  },
  sectionTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  menuGrid: { 
    paddingHorizontal: 15, 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  menuCard: { 
    width: '47%', 
    backgroundColor: COLORS.card, 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 15 
  },
  iconBox: { 
    width: 45, 
    height: 45, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  menuTitle: { color: 'white', fontWeight: '800', fontSize: 13 },
  menuSub: { color: COLORS.subtext, fontSize: 10, marginTop: 2 },
  airportList: { paddingHorizontal: 15 },
  airportCard: { 
    backgroundColor: COLORS.card, 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 10 
  },
  airportHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 5 
  },
  airportCode: { color: 'white', fontSize: 18, fontWeight: '900' },
  airportDistance: { color: COLORS.primary, fontSize: 14 },
  airportName: { color: COLORS.text, fontSize: 12, marginBottom: 2 },
  airportCity: { color: COLORS.subtext, fontSize: 11, marginBottom: 8 },
  runwayContainer: { flexDirection: 'row' },
  runwayTag: { 
    backgroundColor: COLORS.bg, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6, 
    marginRight: 8 
  },
  runwayText: { color: COLORS.subtext, fontSize: 10 },
  subPage: { flex: 1, backgroundColor: COLORS.bg },
  card: { 
    backgroundColor: COLORS.card, 
    padding: 20, 
    borderRadius: 16, 
    marginBottom: 15 
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  cardTitle: { color: 'white', fontSize: 16, fontWeight: '900' },
  linkText: { color: COLORS.primary, fontSize: 12 },
  label: { 
    color: COLORS.subtext, 
    fontSize: 10, 
    fontWeight: '900', 
    letterSpacing: 1, 
    marginBottom: 5 
  },
  subLabel: { 
    color: COLORS.subtext, 
    fontSize: 9, 
    fontWeight: '700', 
    marginBottom: 4 
  },
  input: { 
    backgroundColor: COLORS.bg, 
    color: 'white', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: COLORS.border 
  },
  mainBtn: { 
    backgroundColor: COLORS.primary, 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  secondaryBtn: { 
    backgroundColor: COLORS.card, 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  btnText: { color: 'white', fontWeight: '900' },
  resContainer: { marginTop: 10 },
  resRow: { flexDirection: 'row', justifyContent: 'space-between' },
  resBox: { 
    backgroundColor: COLORS.card, 
    padding: 15, 
    borderRadius: 12, 
    width: '48%', 
    borderWidth: 1, 
    borderColor: COLORS.border 
  },
  resVal: { color: 'white', fontSize: 18, fontWeight: '900' },
  resValLarge: { color: 'white', fontSize: 32, fontWeight: '900' },
  smallText: { color: COLORS.subtext, fontSize: 10, marginTop: 5 },
  categoryBadge: { 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    borderRadius: 20, 
    alignSelf: 'flex-start', 
    marginBottom: 15 
  },
  categoryText: { color: 'white', fontSize: 12, fontWeight: '900' },
  weatherGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  weatherCard: { 
    width: '48%', 
    backgroundColor: COLORS.bg, 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 10,
    alignItems: 'center'
  },
  weatherLabel: { color: COLORS.subtext, fontSize: 9, marginTop: 5 },
  weatherValue: { color: 'white', fontSize: 14, fontWeight: '700', marginTop: 2 },
  detailCard: { backgroundColor: COLORS.bg, padding: 15, borderRadius: 12 },
  detailText: { color: 'white', fontSize: 12, marginTop: 5 },
  acSelector: { marginBottom: 10 },
  acButton: { 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    backgroundColor: COLORS.bg, 
    borderRadius: 8, 
    marginRight: 8 
  },
  acButtonActive: { backgroundColor: COLORS.primary },
  acButtonText: { color: COLORS.subtext, fontSize: 11, fontWeight: '700' },
  acButtonTextActive: { color: 'white' },
  acName: { color: 'white', fontSize: 14, marginBottom: 15 },
  inputGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  inputGroup: { width: '48%', marginBottom: 10 },
  surfaceSelector: { 
    flexDirection: 'row', 
    marginBottom: 15 
  },
  surfaceButton: { 
    flex: 1, 
    padding: 12, 
    backgroundColor: COLORS.bg, 
    borderRadius: 8, 
    marginRight: 8,
    alignItems: 'center'
  },
  surfaceButtonActive: { backgroundColor: COLORS.primary },
  surfaceText: { color: COLORS.subtext, fontSize: 10, fontWeight: '700' },
  surfaceTextActive: { color: 'white' },
  toggleCard: { 
    backgroundColor: COLORS.card, 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 10 
  },
  toggleText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  perfGrid: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 10 
  },
  perfCard: { 
    width: '48%', 
    backgroundColor: COLORS.card, 
    padding: 20, 
    borderRadius: 12,
    alignItems: 'center'
  },
  perfLabel: { color: COLORS.subtext, fontSize: 10, fontWeight: '700' },
  perfValue: { color: 'white', fontSize: 24, fontWeight: '900', marginVertical: 5 },
  perfSub: { color: COLORS.subtext, fontSize: 9 },
  safetyCard: { 
    backgroundColor: COLORS.warning + '20', 
    padding: 20, 
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10
  },
  safetyLabel: { color: COLORS.warning, fontSize: 12, fontWeight: '700' },
  safetyValue: { color: COLORS.warning, fontSize: 28, fontWeight: '900', marginVertical: 5 },
  safetySub: { color: COLORS.subtext, fontSize: 10 },
  vspeedCard: { backgroundColor: COLORS.bg, padding: 15, borderRadius: 12 },
  vspeedGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  vspeedItem: { width: '30%', alignItems: 'center', marginBottom: 10 },
  vspeedLabel: { color: COLORS.subtext, fontSize: 9, fontWeight: '700' },
  vspeedValue: { color: 'white', fontSize: 14, fontWeight: '900' },
  stationRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.bg, 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 8 
  },
  stationInfo: { flex: 1 },
  stationName: { color: 'white', fontSize: 12, fontWeight: '700' },
  stationArm: { color: COLORS.subtext, fontSize: 10, marginTop: 2 },
  stationInput: { 
    backgroundColor: COLORS.card, 
    color: 'white', 
    width: 60, 
    padding: 8, 
    borderRadius: 6, 
    textAlign: 'center' 
  },
  stationUnit: { color: COLORS.subtext, fontSize: 10, marginLeft: 8 },
  envelopeContainer: { backgroundColor: COLORS.card, padding: 20, borderRadius: 12, marginBottom: 10 },
  envelope: { height: 80, backgroundColor: COLORS.bg, borderRadius: 8, marginTop: 10 },
  cgMarker: { position: 'absolute', top: 10, alignItems: 'center' },
  cgDot: { width: 16, height: 16, backgroundColor: COLORS.primary, borderRadius: 8 },
  cgText: { color: COLORS.primary, fontSize: 10, fontWeight: '900', marginTop: 4 },
  envelopeBounds: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 50 },
  envelopeLimit: { alignItems: 'center' },
  limitText: { color: COLORS.subtext, fontSize: 8 },
  limitValue: { color: 'white', fontSize: 12, fontWeight: '900' },
  envelopeArea: { 
    flex: 1, 
    backgroundColor: COLORS.success + '20', 
    height: 20, 
    marginHorizontal: 10,
    borderRadius: 4 
  },
  summaryCard: { backgroundColor: COLORS.card, padding: 20, borderRadius: 12 },
  summaryRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  summaryLabel: { color: COLORS.subtext, fontSize: 12 },
  summaryValue: { color: 'white', fontSize: 16, fontWeight: '900' },
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 10
  },
  statusText: { fontSize: 12, fontWeight: '900', marginLeft: 8 },
  paramGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  paramGroup: { width: '48%' },
  paramUnit: { color: COLORS.subtext, fontSize: 10, position: 'absolute', right: 15, top: 40 },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  navCard: { 
    width: '48%', 
    backgroundColor: COLORS.card, 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 10,
    alignItems: 'center'
  },
  navLabel: { color: COLORS.subtext, fontSize: 10, fontWeight: '700' },
  navValue: { color: 'white', fontSize: 20, fontWeight: '900', marginVertical: 5 },
  navUnit: { color: COLORS.subtext, fontSize: 10 },
  routeCard: { backgroundColor: COLORS.bg, padding: 15, borderRadius: 12, marginBottom: 10 },
  routeText: { color: 'white', fontSize: 14, marginTop: 5 },
  checklistCard: { backgroundColor: COLORS.card, padding: 15, borderRadius: 12 },
  checkItem: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  checkText: { color: 'white', fontSize: 12, marginLeft: 10 },
  emergencyBanner: { 
    flexDirection: 'row', 
    backgroundColor: COLORS.danger, 
    padding: 15, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  emergencyText: { color: 'white', fontSize: 14, fontWeight: '900', marginHorizontal: 10 },
  emergencySelector: { marginBottom: 15 },
  emergencyButton: { 
    backgroundColor: COLORS.bg, 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 8 
  },
  emergencyButtonActive: { backgroundColor: COLORS.danger },
  emergencyButtonText: { color: COLORS.subtext, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  emergencyButtonTextActive: { color: 'white' },
  checklistContainer: { marginBottom: 15 },
  checklistItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.bg, 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 8 
  },
  checklistItemChecked: { backgroundColor: COLORS.success + '20' },
  checklistNumber: { 
    width: 24, 
    height: 24, 
    backgroundColor: COLORS.primary, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 10
  },
  checklistNumberText: { color: 'white', fontSize: 12, fontWeight: '900' },
  checklistText: { flex: 1, color: 'white', fontSize: 12 },
  checklistTextChecked: { color: COLORS.success, textDecorationLine: 'line-through' },
  emergencyActions: { flexDirection: 'row', justifyContent: 'space-between' },
  emergencyActionBtn: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  emergencyActionText: { color: 'white', fontSize: 12, fontWeight: '900' },
  resultText: { color: COLORS.primary, fontSize: 14, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  freqItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.bg, 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 8 
  },
  freqValue: { color: COLORS.primary, fontSize: 14, fontWeight: '900', width: 70 },
  freqName: { color: 'white', fontSize: 12, flex: 1 },
  freqUse: { color: COLORS.subtext, fontSize: 10 },
  calcHeader: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  calcTab: { alignItems: 'center', padding: 10 },
  calcTabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  calcTabText: { color: COLORS.subtext, fontSize: 10, marginTop: 4 },
  calcTabTextActive: { color: COLORS.primary },
  resultCard: { 
    backgroundColor: COLORS.card, 
    padding: 30, 
    borderRadius: 12, 
    alignItems: 'center',
    marginBottom: 10
  },
  resultLabel: { color: COLORS.subtext, fontSize: 12, fontWeight: '700' },
  resultValue: { color: 'white', fontSize: 36, fontWeight: '900', marginVertical: 10 },
  resultUnit: { color: COLORS.primary, fontSize: 24 },
  tipsCard: { backgroundColor: COLORS.card, padding: 20, borderRadius: 12 },
  tipText: { color: 'white', fontSize: 12, marginTop: 5, lineHeight: 18 },
});