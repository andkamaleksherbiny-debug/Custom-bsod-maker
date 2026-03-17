/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Monitor, Play, Settings, X, Info, Github, Sparkles, Loader2, StopCircle, Dices } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { QRCodeSVG } from 'qrcode.react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

type BSODConfig = {
  errorCode: string;
  percentage: number;
  qrText: string;
  autoRestart: boolean;
  bgColor: string;
  sadFace: string;
  mainText: string;
  percentageText: string;
  version: 'win11' | 'win10' | 'win7' | 'win98' | 'chromeos' | 'macos' | 'android' | 'linux';
  fontFamily: string;
  fontColor: string;
};

const DEFAULT_CONFIG: BSODConfig = {
  errorCode: "CRITICAL_PROCESS_DIED",
  percentage: 0,
  qrText: "https://windows.com/stopcode",
  autoRestart: false,
  bgColor: "#0078d7",
  sadFace: ":(",
  mainText: "Your PC ran into a problem and needs to restart. We're just collecting some error info, and then we'll restart for you.",
  percentageText: "complete",
  version: 'win11',
  fontFamily: 'Segoe UI',
  fontColor: '#ffffff',
};

const isLightColor = (color: string) => {
  if (!color.startsWith('#')) return false;
  const hex = color.replace('#', '');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
};

export default function App() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingFont, setIsGeneratingFont] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [config, setConfig] = useState<BSODConfig>(DEFAULT_CONFIG);
  const [currentPercentage, setCurrentPercentage] = useState(0);
  const generationId = useRef(0);

  // Dynamically load Google Fonts
  useEffect(() => {
    if (config.fontFamily && config.fontFamily !== 'Segoe UI') {
      const linkId = 'dynamic-google-font';
      let link = document.getElementById(linkId) as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      const formattedFont = config.fontFamily.replace(/\s+/g, '+');
      link.href = `https://fonts.googleapis.com/css2?family=${formattedFont}:wght@300;400;500;700&display=swap`;
    }
  }, [config.fontFamily]);

  const cancelGeneration = () => {
    generationId.current++;
    setIsGenerating(false);
    setIsGeneratingFont(false);
  };

  const generateAIConfig = async () => {
    const id = ++generationId.current;
    setIsGenerating(true);
    try {
      const userPrompt = aiPrompt.trim() 
        ? `Generate a Windows Blue Screen of Death configuration based on this theme: "${aiPrompt}".`
        : "Generate a creative, funny, or realistic Windows Blue Screen of Death configuration. Be creative with the stop code and message.";

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              errorCode: { type: Type.STRING, description: "Uppercase stop code with underscores" },
              qrText: { type: Type.STRING, description: "A support URL" },
              bgColor: { type: Type.STRING, description: "Hex color code for the background" },
              sadFace: { type: Type.STRING, description: "A text emoticon like :( or D:" },
              mainText: { type: Type.STRING, description: "The main error message" },
              percentageText: { type: Type.STRING, description: "A word like 'complete' or 'finished'" },
              version: { type: Type.STRING, enum: ["win11", "win10", "win7", "win98", "chromeos", "macos", "android", "linux"], description: "The OS version style" },
              fontFamily: { type: Type.STRING, description: "A valid Google Font name that matches the theme" },
              fontColor: { type: Type.STRING, description: "Hex color code for the text (should contrast well with bgColor)" },
            },
            required: ["errorCode", "qrText", "bgColor", "sadFace", "mainText", "percentageText", "version", "fontFamily", "fontColor"],
          },
        },
      });

      if (id !== generationId.current) return;

      const result = JSON.parse(response.text || '{}');
      setConfig(prev => ({
        ...prev,
        ...result,
        percentage: 0,
        autoRestart: false
      }));
    } catch (error) {
      if (id === generationId.current) {
        console.error("AI Generation failed:", error);
      }
    } finally {
      if (id === generationId.current) {
        setIsGenerating(false);
      }
    }
  };

  const generateFontOnly = async (isSurprise = false) => {
    const id = ++generationId.current;
    const trimmedPrompt = aiPrompt.trim();
    
    // If prompt is empty and not a surprise, we'll treat it as a surprise (custom font)
    const effectiveSurprise = isSurprise || !trimmedPrompt;
    
    setIsGeneratingFont(true);
    try {
      const prompt = effectiveSurprise 
        ? "Suggest ONE unique, high-quality, and visually striking Google Font name. Pick something interesting like 'Permanent Marker', 'UnifrakturMaguntia', 'Monoton', or 'Nosifer'."
        : `You are a typography expert. Suggest exactly ONE popular Google Font name that perfectly matches the theme: "${trimmedPrompt}". 
           Prioritize fonts that are highly legible but thematic. 
           Output ONLY the font name (e.g., "Orbitron", "Creepster", "Press Start 2P", "Bungee"). 
           Do not include any other text, quotes, or explanations.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      
      if (id !== generationId.current) return;

      const text = response.text;
      if (!text) throw new Error("Empty response from AI");
      
      // Clean up the response to get just the font name
      const fontName = text.trim().replace(/[*'"`().]/g, '');
      console.log(`AI suggested font: ${fontName} for theme: ${trimmedPrompt}`);
      
      if (fontName) {
        setConfig(prev => ({ ...prev, fontFamily: fontName }));
      }
    } catch (error) {
      if (id === generationId.current) {
        console.error("Font generation failed:", error);
      }
    } finally {
      if (id === generationId.current) {
        setIsGeneratingFont(false);
      }
    }
  };

  const startSimulation = useCallback(() => {
    setIsSimulating(true);
    setCurrentPercentage(100);
    
    // Attempt to go fullscreen
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen request failed", e);
    }
  }, []);

  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopSimulation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stopSimulation]);

  useEffect(() => {
    // Progress interval removed as per "Without loading" request
  }, [isSimulating, currentPercentage]);

  useEffect(() => {
    if (config.fontFamily && config.fontFamily !== 'Segoe UI') {
      const fontId = `google-font-${config.fontFamily.replace(/\s+/g, '-').toLowerCase()}`;
      if (!document.getElementById(fontId)) {
        console.log(`Loading Google Font: ${config.fontFamily}`);
        const link = document.createElement('link');
        link.id = fontId;
        link.href = `https://fonts.googleapis.com/css2?family=${config.fontFamily.replace(/\s+/g, '+')}&display=swap`;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
    }
  }, [config.fontFamily]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-blue-500/30">
      <AnimatePresence>
        {!isSimulating ? (
          <motion.main 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-4xl mx-auto px-6 py-12 md:py-24"
          >
            <header className="mb-16 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider">
                <Monitor className="w-3 h-3" />
                System Utility
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white">
                BSOD <span className="text-blue-500">Maker</span>
              </h1>
              <p className="text-xl text-zinc-400 max-w-2xl leading-relaxed">
                A fully customizable Blue Screen of Death creator. 
                Change colors, text, stop codes, and more to create the perfect prank or UI mockup.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <section className="md:col-span-2 space-y-8">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-3 text-white font-semibold text-lg">
                    <Settings className="w-5 h-5 text-blue-500" />
                    Configuration
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Windows Style</label>
                      <select 
                        value={config.version}
                        onChange={(e) => setConfig({...config, version: e.target.value as any})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
                      >
                        <option value="win11">Windows 11 (Modern)</option>
                        <option value="win10">Windows 10 (Classic)</option>
                        <option value="win7">Windows 7 / Vista</option>
                        <option value="win98">Windows 98 / XP (Retro)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Font Family</label>
                        {config.fontFamily !== 'Segoe UI' && (
                          <span className="text-[10px] text-blue-400 font-mono animate-pulse">Google Font Active</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input 
                            type="text" 
                            value={config.fontFamily}
                            onChange={(e) => setConfig({...config, fontFamily: e.target.value})}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            placeholder="e.g. Orbitron, Creepster..."
                            style={{ fontFamily: config.fontFamily === 'Segoe UI' ? 'inherit' : `"${config.fontFamily}", sans-serif` }}
                          />
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => isGeneratingFont ? cancelGeneration() : generateFontOnly(false)}
                            title={isGeneratingFont ? "Cancel generation" : "Generate font from theme"}
                            className={`px-3 border rounded-xl transition-all group relative ${
                              isGeneratingFont 
                                ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20" 
                                : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-blue-400 transition-all group-hover:scale-105 active:scale-95"
                            }`}
                          >
                            {isGeneratingFont ? <StopCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => generateFontOnly(true)}
                            disabled={isGeneratingFont}
                            title="Surprise me with a random cool font"
                            className="px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-purple-400 rounded-xl transition-all disabled:opacity-30"
                          >
                            <Dices className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Stop Code</label>
                      <input 
                        type="text" 
                        value={config.errorCode}
                        onChange={(e) => setConfig({...config, errorCode: e.target.value})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        placeholder="e.g. CRITICAL_PROCESS_DIED"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-500 uppercase tracking-wide">QR Code URL</label>
                      <input 
                        type="text" 
                        value={config.qrText}
                        onChange={(e) => setConfig({...config, qrText: e.target.value})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        placeholder="https://windows.com/stopcode"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Background Color</label>
                      <div className="flex gap-2">
                        <input 
                          type="color" 
                          value={config.bgColor}
                          onChange={(e) => setConfig({...config, bgColor: e.target.value})}
                          className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-xl cursor-pointer"
                        />
                        <input 
                          type="text" 
                          value={config.bgColor}
                          onChange={(e) => setConfig({...config, bgColor: e.target.value})}
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Font Color</label>
                      <div className="flex gap-2">
                        <input 
                          type="color" 
                          value={config.fontColor}
                          onChange={(e) => setConfig({...config, fontColor: e.target.value})}
                          className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-xl cursor-pointer"
                        />
                        <input 
                          type="text" 
                          value={config.fontColor}
                          onChange={(e) => setConfig({...config, fontColor: e.target.value})}
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Sad Face Icon</label>
                      <input 
                        type="text" 
                        value={config.sadFace}
                        onChange={(e) => setConfig({...config, sadFace: e.target.value})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        placeholder=":("
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <label className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Main Message</label>
                      <textarea 
                        value={config.mainText}
                        onChange={(e) => setConfig({...config, mainText: e.target.value})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[100px]"
                        placeholder="Enter the error message..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Percentage Label</label>
                      <input 
                        type="text" 
                        value={config.percentageText}
                        onChange={(e) => setConfig({...config, percentageText: e.target.value})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        placeholder="complete"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                    <div className="relative">
                      <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                      <input 
                        type="text" 
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && generateAIConfig()}
                        placeholder="Describe a theme (e.g. 'Matrix', 'Coffee spill', 'Alien invasion')..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-11 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                      />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <button 
                        onClick={startSimulation}
                        className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                      >
                        <Play className="w-5 h-5 fill-current" />
                        Trigger Simulation
                      </button>
                      <button 
                        onClick={isGenerating ? cancelGeneration : generateAIConfig}
                        className={`w-full sm:w-auto font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 border ${
                          isGenerating 
                            ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20" 
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        }`}
                      >
                        {isGenerating ? (
                          <>
                            <StopCircle className="w-5 h-5" />
                            Cancel
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 text-blue-400" />
                            AI Generate
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/50">
                  <Info className="w-6 h-6 text-zinc-500 shrink-0 mt-1" />
                  <div className="text-sm text-zinc-500 leading-relaxed">
                    <p className="font-semibold text-zinc-300 mb-1">Pro Tip</p>
                    Press <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">ESC</kbd> at any time to exit the simulation. This tool is for educational and entertainment purposes only.
                  </div>
                </div>
              </section>

              <aside className="space-y-6">
                <div 
                  className="rounded-3xl p-6 aspect-square flex flex-col justify-between shadow-2xl relative overflow-hidden group"
                  style={{ 
                    background: `linear-gradient(to bottom right, ${config.bgColor}, ${config.bgColor}dd)`,
                    fontFamily: config.fontFamily === 'Segoe UI' ? 'var(--font-segoe)' : `"${config.fontFamily}", sans-serif`,
                    color: config.fontColor
                  }}
                >
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                  <button 
                    onClick={startSimulation}
                    className="absolute top-4 right-4 z-20 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100 bg-white/10 hover:bg-white/20 text-white/50 hover:text-white"
                    title="Enter Full Screen Simulator"
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <div className="relative z-10">
                    <div className="text-4xl font-bold mb-2 leading-none" style={{ color: config.fontColor }}>{config.sadFace}</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-70">Live Preview</div>
                  </div>
                  <div className="relative z-10 flex justify-between items-end">
                    <div className="space-y-3 flex-1">
                      <div className="space-y-1">
                        <div className="h-1 w-full rounded-full overflow-hidden bg-white/20">
                          <div className="h-full w-1/3 bg-white/80" style={{ backgroundColor: config.fontColor }}></div>
                        </div>
                        <div className="text-[8px] uppercase tracking-wider opacity-50">Collecting info...</div>
                      </div>
                      <div className="text-[9px] leading-tight line-clamp-2 opacity-80">
                        {config.mainText}
                      </div>
                      <div className="text-[10px] truncate font-medium border-t pt-2 border-white/10">
                        CODE: {config.errorCode}
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-white p-1 ml-4 shrink-0 rounded-sm shadow-inner">
                      <QRCodeSVG value={config.qrText} size={40} className="w-full h-full" />
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800 space-y-4">
                  <h3 className="font-semibold text-white">Screen Presets</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: "Classic BSOD", color: "#0078d7", version: 'win10' },
                      { name: "Windows 11", color: "#004a92", version: 'win11' },
                      { name: "Insider GSOD", color: "#107c10", version: 'win10' },
                      { name: "Critical RSOD", color: "#e81123", version: 'win10' },
                      { name: "Deep Purple", color: "#4b0082", version: 'win10' },
                      { name: "OLED Black", color: "#000000", version: 'win11' },
                      { name: "Legacy 7", color: "#0000aa", version: 'win7' },
                      { name: "Retro 98", color: "#0000aa", version: 'win98' },
                      { name: "macOS Modern", color: "#000000", version: 'macos' },
                      { name: "Linux Panic", color: "#000000", version: 'linux' },
                      { name: "ChromeOS Dev", color: "#ffffff", version: 'chromeos' },
                      { name: "Android Dump", color: "#000000", version: 'android' },
                    ].map(preset => (
                      <button 
                        key={preset.name}
                        onClick={() => {
                          const newConfig = {
                            ...config, 
                            bgColor: preset.color, 
                            version: preset.version as any,
                            fontColor: isLightColor(preset.color) ? "#202124" : "#ffffff"
                          };

                          if (preset.name === 'ChromeOS Dev') {
                            newConfig.sadFace = "!";
                            newConfig.mainText = "OS verification is OFF";
                            newConfig.errorCode = "Press SPACE to re-enable";
                            newConfig.fontColor = "#000000";
                          } else if (preset.name === 'macOS Modern') {
                            newConfig.sadFace = "";
                            newConfig.mainText = "Your computer restarted because of a problem. Press a key or wait a few seconds to continue starting up.";
                            newConfig.errorCode = "panic(cpu 0 caller 0xffffff8018e66695)";
                          } else if (preset.name === 'Linux Panic') {
                            newConfig.sadFace = "[!]";
                            newConfig.mainText = "Kernel panic - not syncing: Fatal exception in interrupt";
                            newConfig.errorCode = "EIP: [<c0110ef0>] exit_notify+0x30/0x2b0";
                            newConfig.fontFamily = "JetBrains Mono";
                          } else if (preset.name === 'Android Dump') {
                            newConfig.sadFace = "Qualcomm";
                            newConfig.mainText = "CrashDump Mode";
                            newConfig.errorCode = "Error: lpass_q6_err_fatal_handler";
                          }

                          setConfig(newConfig);
                        }}
                        className="text-[10px] px-2 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors flex items-center gap-2"
                      >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.color }}></div>
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800 space-y-4">
                  <h3 className="font-semibold text-white">Common Stop Codes</h3>
                  <div className="flex flex-wrap gap-2">
                    {["PAGE_FAULT_IN_NONPAGED_AREA", "IRQL_NOT_LESS_OR_EQUAL", "MEMORY_MANAGEMENT", "SYSTEM_SERVICE_EXCEPTION"].map(code => (
                      <button 
                        key={code}
                        onClick={() => setConfig({...config, errorCode: code})}
                        className="text-[10px] px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>

            <footer className="mt-24 pt-8 border-t border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-6 text-zinc-500 text-sm">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                <span>© 2026 BSOD Simulator Project</span>
              </div>
              <div className="flex items-center gap-6">
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                <a href="https://github.com" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Github className="w-4 h-4" />
                  Source
                </a>
              </div>
            </footer>
          </motion.main>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[9999] cursor-none flex p-8 md:p-24 overflow-hidden ${
              config.version === 'win11' ? 'items-center justify-center' : 'items-start justify-start'
            }`}
            style={{ 
              backgroundColor: config.bgColor,
              fontFamily: config.fontFamily === 'Segoe UI' ? 'var(--font-segoe)' : `"${config.fontFamily}", sans-serif`,
              color: config.fontColor
            }}
            onClick={stopSimulation} // Hidden exit
          >
            {config.version === 'android' ? (
              <div className="max-w-4xl w-full font-mono space-y-4 select-none text-left" style={{ color: config.fontColor }}>
                <h1 className="text-2xl md:text-3xl font-bold">{config.sadFace} {config.mainText}</h1>
                <div className="space-y-1 opacity-90 text-sm md:text-base">
                  <p>Attempting to dump logs...</p>
                  <p>--------------------------------------------------</p>
                  <p>Subsystem: Modem</p>
                  <p>Reason: {config.errorCode}</p>
                  <p>CPU: 0</p>
                  <p>PC: 0x00000000</p>
                  <p>LR: 0x00000000</p>
                  <p>--------------------------------------------------</p>
                  <p className="pt-8 animate-pulse">_ Waiting for USB connection...</p>
                </div>
              </div>
            ) : config.version === 'macos' ? (
              <div className="max-w-3xl w-full flex flex-col items-center text-center space-y-12 select-none">
                <div className="w-24 h-24 text-white opacity-90">
                  <span className="text-8xl"></span>
                </div>
                <div className="space-y-8 max-w-xl">
                  <h1 className="text-xl md:text-2xl font-medium leading-relaxed" style={{ color: config.fontColor }}>
                    {config.mainText}
                  </h1>
                  <div className="space-y-4 text-sm opacity-60">
                    <p>Le redémarrage de votre ordinateur est dû à un problème. Pour continuer le démarrage, appuyez sur une touche ou attendez quelques secondes.</p>
                    <p>Your computer restarted because of a problem. Press a key or wait a few seconds to continue starting up.</p>
                  </div>
                  <div className="pt-12 text-[10px] font-mono opacity-30 uppercase tracking-widest">
                    {config.errorCode}
                  </div>
                </div>
              </div>
            ) : config.version === 'chromeos' ? (
              <div className="max-w-4xl w-full flex flex-col items-center text-center space-y-12 select-none">
                <div className="w-16 h-16 rounded-full border-4 border-red-600 flex items-center justify-center">
                  <span className="text-4xl font-bold text-red-600">!</span>
                </div>
                <div className="space-y-6">
                  <h1 className="text-3xl md:text-5xl font-bold text-red-600">
                    {config.mainText}
                  </h1>
                  <div className="space-y-2 text-xl opacity-80" style={{ color: config.fontColor }}>
                    <p>Your system is in Developer Mode.</p>
                    <p>Press SPACE to re-enable OS verification.</p>
                  </div>
                </div>
                <div className="pt-24 text-sm font-mono opacity-50" style={{ color: config.fontColor }}>
                  {config.errorCode}
                </div>
              </div>
            ) : config.version === 'linux' ? (
              <div className="max-w-6xl w-full font-mono space-y-4 select-none" style={{ color: config.fontColor }}>
                <p className="text-xl md:text-2xl">{config.sadFace} {config.mainText}</p>
                <div className="space-y-1 opacity-80 text-sm md:text-base">
                  <p>Call Trace:</p>
                  <p> [&lt;c0110ef0&gt;] exit_notify+0x30/0x2b0</p>
                  <p> [&lt;c0109404&gt;] do_exit+0x374/0x3e0</p>
                  <p> [&lt;c0109500&gt;] sys_exit+0x10/0x20</p>
                  <p> [&lt;c010712b&gt;] syscall_call+0x7/0xb</p>
                  <p className="pt-4">Code: 8b 40 10 85 c0 74 0a 8b 40 04 85 c0 75 04 0f 0b eb fe 8b 00</p>
                  <p className="pt-4 font-bold">{config.errorCode}</p>
                  <p className="pt-8 animate-pulse">_ system halted</p>
                </div>
              </div>
            ) : config.version === 'win98' || config.version === 'win7' ? (
              <div className="max-w-6xl w-full space-y-8 select-none" style={{ color: config.fontColor }}>
                <div className="bg-white text-blue-800 px-4 py-1 inline-block font-bold">
                  Windows
                </div>
                <div className="space-y-6">
                  <p className="text-lg md:text-2xl uppercase">
                    A problem has been detected and Windows has been shut down to prevent damage to your computer.
                  </p>
                  <p className="text-lg md:text-2xl uppercase font-bold">
                    {config.errorCode}
                  </p>
                  <div className="space-y-4 text-base md:text-xl opacity-90">
                    <p>If this is the first time you've seen this Stop error screen, restart your computer. If this screen appears again, follow these steps:</p>
                    <p>Check to be sure any new hardware or software is properly installed. If this is a new installation, ask your hardware or software manufacturer for any Windows updates you might need.</p>
                    <p>If problems continue, disable or remove any newly installed hardware or software. Disable BIOS memory options such as caching or shadowing.</p>
                  </div>
                  <div className="pt-8 border-t border-white/20 space-y-2">
                    <p className="font-bold">Technical information:</p>
                    <p>*** STOP: 0x0000001E (0xFFFFFFFFC0000005, 0xFFFFF80002AD3512, 0x0000000000000000, 0x0000000000000000)</p>
                    <p>*** {config.errorCode} - Address 0xFFFFF80002AD3512 base at 0xFFFFF80002A00000, DateStamp 0x4a5bc119</p>
                  </div>
                  <p className="animate-pulse">Press any key to terminate the current application...</p>
                </div>
              </div>
            ) : (
              <div className={`max-w-5xl w-full space-y-8 md:space-y-12 ${config.version === 'win11' ? 'text-center flex flex-col items-center' : ''}`} style={{ color: config.fontColor }}>
                <div className="text-[80px] md:text-[160px] leading-none font-light select-none">
                  {config.sadFace}
                </div>
                
                <div className="space-y-6 md:space-y-8">
                  <p className="text-xl md:text-3xl font-light leading-relaxed max-w-4xl">
                    {config.mainText}
                  </p>
                  
                  <div className="text-xl md:text-3xl font-light">
                    {currentPercentage}% {config.percentageText}
                  </div>
                </div>

                <div className={`flex flex-col md:flex-row gap-8 items-start ${config.version === 'win11' ? 'justify-center' : ''}`}>
                  <div className="w-24 h-24 md:w-32 md:h-32 bg-white p-1 shrink-0 flex items-center justify-center">
                    <QRCodeSVG 
                      value={config.qrText} 
                      size={128}
                      level="L"
                      includeMargin={false}
                      className="w-full h-full"
                    />
                  </div>
                  
                  <div className={`space-y-4 text-sm md:text-base font-light text-white/90 ${config.version === 'win11' ? 'text-left' : ''}`}>
                    <p className="max-w-md">
                      For more information about this issue and possible fixes, visit {config.qrText}
                    </p>
                    <div className="space-y-1">
                      <p>If you call a support person, give them this info:</p>
                      <p className="font-medium">Stop code: {config.errorCode}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
