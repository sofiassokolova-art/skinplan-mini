import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  RotateCcw, 
  Camera, 
  Sparkles, 
  Heart,
  TrendingUp,
  Droplets,
  Sun,
  Shield,
  Star
} from 'lucide-react';
import './App.css';

function App() {
  const [isMorning, setIsMorning] = useState(true);
  const [completedSteps, setCompletedSteps] = useState([false, false, false, false]);
  const [showCompletion, setShowCompletion] = useState(false);

  const careSteps = [
    { id: 1, name: 'Очищение', icon: Droplets },
    { id: 2, name: 'Тонизирование', icon: Sparkles },
    { id: 3, name: 'Увлажнение', icon: Heart },
    { id: 4, name: 'SPF', icon: Sun }
  ];

  const completedCount = completedSteps.filter(Boolean).length;
  const progress = (completedCount / careSteps.length) * 100;
  const remainingSteps = careSteps.length - completedCount;
  const estimatedTime = remainingSteps * 1.5; // 1.5 минуты на шаг
  const isAllCompleted = completedCount === careSteps.length;

  const toggleStep = (index) => {
    setCompletedSteps(prev => {
      const newSteps = [...prev];
      newSteps[index] = !newSteps[index];
      return newSteps;
    });
  };

  // Show completion celebration when all steps are done
  useEffect(() => {
    if (isAllCompleted && !showCompletion) {
      setShowCompletion(true);
      setTimeout(() => setShowCompletion(false), 3000);
    }
  }, [isAllCompleted, showCompletion]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 gradient-bg"></div>
      <div className="absolute inset-0 lab-pattern"></div>
      
      {/* Floating Laboratory Elements */}
      <motion.div 
        className="absolute top-20 left-10 w-16 h-16 bg-white/8 rounded-full blur-xl"
        animate={{ 
          y: [0, -15, 0],
          x: [0, 8, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ 
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div 
        className="absolute top-40 right-16 w-12 h-12 bg-accent-pink/15 rounded-full blur-lg"
        animate={{ 
          y: [0, 12, 0],
          x: [0, -12, 0],
          scale: [1, 0.9, 1]
        }}
        transition={{ 
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />
      <motion.div 
        className="absolute bottom-32 left-20 w-20 h-20 bg-accent-skyBlue/12 rounded-full blur-2xl"
        animate={{ 
          y: [0, -20, 0],
          x: [0, 15, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ 
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
      />
      <motion.div 
        className="absolute top-60 left-1/2 w-10 h-10 bg-accent-scarlet/12 rounded-full blur-lg"
        animate={{ 
          y: [0, -12, 0],
          x: [0, 20, 0],
          scale: [1, 1.3, 1]
        }}
        transition={{ 
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header Section */}
        <motion.div 
          className="pt-16 pb-6 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.h1 
            className="text-3xl font-bold text-white mb-3"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            SkinIQ
          </motion.h1>
          <motion.h2 
            className="text-hero font-playfair text-white mb-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            Привет, Аня! ✨
          </motion.h2>
          <motion.p 
            className="text-body-secondary text-white/80"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            Твой уход на сегодня готов
          </motion.p>
        </motion.div>

        {/* Progress Circle Section */}
        <motion.div 
          className="flex flex-col items-center mb-6"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* Progress Circle */}
          <div className="relative mb-6">
            <svg className="w-50 h-50 progress-circle" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#A58BFF" />
                  <stop offset="100%" stopColor="#6C4BFF" />
                </linearGradient>
              </defs>
              <circle
                className="progress-circle-bg"
                cx="50"
                cy="50"
                r="40"
              />
              <motion.circle
                className={`progress-circle-fill ${isAllCompleted ? 'progress-circle-completed' : ''}`}
                cx="50"
                cy="50"
                r="40"
                initial={{ strokeDashoffset: 251.2 }}
                animate={{ strokeDashoffset: 251.2 - (progress * 2.512) }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white">{Math.round(progress)}%</span>
              <span className="text-body-secondary text-white/70 text-center">
                Осталось {remainingSteps} шага<br />
                / {estimatedTime} мин
              </span>
            </div>
          </div>

          {/* Morning/Evening Toggle */}
          <motion.div 
            className="glass rounded-full p-1 flex w-35 h-10"
            whileHover={{ scale: 1.02 }}
          >
            <motion.button
              onClick={() => setIsMorning(true)}
              className={`flex-1 rounded-full text-sm font-medium transition-all duration-300 ${
                isMorning 
                  ? 'bg-white text-text-main shadow-sm' 
                  : 'text-white/70 hover:text-white'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              Утро
            </motion.button>
            <motion.button
              onClick={() => setIsMorning(false)}
              className={`flex-1 rounded-full text-sm font-medium transition-all duration-300 ${
                !isMorning 
                  ? 'bg-white text-text-main shadow-sm' 
                  : 'text-white/70 hover:text-white'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              Вечер
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Care Steps Section */}
        <motion.div 
          className="mx-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <div className="glass-strong rounded-3xl p-6 backdrop-blur-lg shadow-lg">
            <h2 className="text-section font-inter text-text-main mb-4 text-center">
              Сегодняшний уход
            </h2>
            <div className="space-y-3">
              {careSteps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = completedSteps[index];
                
                return (
                  <motion.div
                    key={step.id}
                    className="bg-white rounded-2xl shadow-sm flex justify-between items-center px-4 h-14 cursor-pointer"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleStep(index)}
                    whileHover={{ scale: 1.01 }}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-5 h-5 text-text-secondary" />
                      <span className="text-body-main text-text-main">{step.name}</span>
                    </div>
                    <motion.div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isCompleted 
                          ? 'bg-primary-violet border-primary-violet' 
                          : 'border-primary-violet bg-white'
                      }`}
                      animate={{ scale: isCompleted ? [1, 1.1, 1] : 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <AnimatePresence>
                        {isCompleted && (
                          <motion.div
                            className="spring-check"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{ 
                              type: "spring", 
                              stiffness: 500, 
                              damping: 25 
                            }}
                          >
                            <Check className="w-3 h-3 text-white" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
            <motion.button
              className="w-full mt-4 py-3 border border-primary-violet text-primary-violet rounded-xl font-medium hover:bg-primary-violet/10 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Перейти к плану
            </motion.button>
          </div>
        </motion.div>

        {/* Expert Advice Section */}
        <motion.div 
          className="mx-4 mb-6 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          {/* Daily Expert Tip */}
          <div className="glass-strong rounded-2xl p-4 shadow-sm">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-primary-violet/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Star className="w-4 h-4 text-primary-violet" />
              </div>
              <div>
                <p className="text-body-secondary text-text-main font-medium mb-1">
                  Экспертная рекомендация
                </p>
                <p className="text-body-secondary text-text-secondary">
                  Сегодня кожа сухая — добавь больше увлажнения 🌸
                </p>
              </div>
            </div>
          </div>

          {/* Recommendations Grid */}
          <div className="flex space-x-3">
            <div className="flex-1 glass-strong rounded-2xl p-4 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="w-4 h-4 text-primary-violet" />
                <span className="text-body-secondary font-medium text-text-main">Рекомендация дня</span>
              </div>
              <p className="text-xs text-text-secondary">Используй увлажняющий крем</p>
            </div>
            <div className="flex-1 glass-strong rounded-2xl p-4 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary-violet" />
                <span className="text-body-secondary font-medium text-text-main">История прогресса</span>
              </div>
              <p className="text-xs text-text-secondary">Ты ухаживала за собой 5 дней на этой неделе 💕</p>
            </div>
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.div 
          className="mx-4 mt-auto mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <motion.button
            className="w-full glass-cta rounded-3xl h-16 flex items-center justify-between relative overflow-hidden border border-white/30"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="shimmer absolute inset-0"></div>
            <div className="relative z-10 flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <RotateCcw className="w-4 h-4 text-white" />
              </div>
              <span className="text-cta text-white font-semibold">Начать сканирование</span>
            </div>
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
          </motion.button>
        </motion.div>

        {/* Completion Celebration */}
        <AnimatePresence>
          {showCompletion && (
            <motion.div
              className="fixed inset-0 flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white/95 backdrop-blur-lg rounded-3xl p-8 text-center shadow-2xl"
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <motion.div
                  className="w-16 h-16 bg-primary-violet rounded-full flex items-center justify-center mx-auto mb-4"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 1, ease: "easeInOut" }}
                >
                  <Star className="w-8 h-8 text-white" />
                </motion.div>
                <h3 className="text-2xl font-bold text-text-main mb-2">✨ Уход завершён!</h3>
                <p className="text-body-secondary text-text-secondary">
                  Отличная работа! Твоя кожа скажет тебе спасибо 💕
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;