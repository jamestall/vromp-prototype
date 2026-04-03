import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertCircle,
  Camera,
  Clock3,
  DollarSign,
  ParkingCircle,
  Store,
  UtensilsCrossed,
} from 'lucide-react-native';
import type {TripStop} from './trips';

type RevealScreenProps = {
  stop: TripStop;
  stopNumber: number;
  totalStops: number;
  onReadyToGo: () => void;
  isLastStop: boolean;
};

type TabName = 'whatToDo' | 'proTips' | 'story';

const CONDITIONAL_BLOCKS: {
  key: keyof TripStop;
  label: string;
  icon: React.ComponentType<{size?: number; color?: string}>;
}[] = [
  {key: 'whatToOrder', label: 'What to Order', icon: UtensilsCrossed},
  {key: 'photoTips', label: 'Photo Tips', icon: Camera},
  {key: 'parkingNotes', label: 'Parking', icon: ParkingCircle},
  {key: 'safetyNotes', label: 'Safety', icon: AlertCircle},
];

export default function RevealScreen({
  stop,
  stopNumber,
  totalStops,
  onReadyToGo,
  isLastStop,
}: RevealScreenProps) {
  const [activeTab, setActiveTab] = useState<TabName>('whatToDo');
  const animComplete = useRef(false);
  const hasInteracted = useRef(false);

  // 4 animated phase values
  const phase0 = useRef(new Animated.Value(0)).current;
  const phase1 = useRef(new Animated.Value(0)).current;
  const phase2 = useRef(new Animated.Value(0)).current;
  const phase3 = useRef(new Animated.Value(0)).current;

  // Emoji-specific spring scale
  const emojiScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sequence = Animated.sequence([
      // Phase 0: "You've Arrived" badge
      Animated.timing(phase0, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Phase 1: Emoji + Name + Subtitle
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(emojiScale, {
          toValue: 1,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(phase1, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Phase 2: Divider + Hook
      Animated.delay(200),
      Animated.timing(phase2, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Phase 3: Practical strip + tabs
      Animated.delay(200),
      Animated.timing(phase3, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]);

    sequence.start(() => {
      animComplete.current = true;
    });

    return () => sequence.stop();
  }, [phase0, phase1, phase2, phase3, emojiScale]);

  const skipAnimation = useCallback(() => {
    if (animComplete.current || hasInteracted.current) {
      return;
    }
    hasInteracted.current = true;
    phase0.setValue(1);
    phase1.setValue(1);
    phase2.setValue(1);
    phase3.setValue(1);
    emojiScale.setValue(1);
    animComplete.current = true;
  }, [phase0, phase1, phase2, phase3, emojiScale]);

  const renderConditionalBlocks = () => {
    const blocks = CONDITIONAL_BLOCKS.filter(b => {
      const val = stop[b.key];
      return val != null && val !== '';
    });
    if (blocks.length === 0) {
      return null;
    }
    return (
      <View style={s.conditionalContainer}>
        {blocks.map(block => {
          const BlockIcon = block.icon;
          return (
            <View key={block.key} style={s.conditionalCard}>
              <View style={s.conditionalHeader}>
                <BlockIcon size={16} color="#e94560" />
                <Text style={s.conditionalLabel}>{block.label}</Text>
              </View>
              <Text style={s.conditionalText}>
                {String(stop[block.key])}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'whatToDo':
        return (
          <View>
            {stop.whatToDo.map((step, i) => (
              <View key={i} style={s.stepRow}>
                <Text style={s.stepNumber}>{i + 1}.</Text>
                <Text style={s.stepText}>{step}</Text>
              </View>
            ))}
            {renderConditionalBlocks()}
          </View>
        );
      case 'proTips':
        return (
          <View>
            {stop.proTips.map((tip, i) => (
              <View key={i} style={s.stepRow}>
                <Text style={s.bulletPoint}>•</Text>
                <Text style={s.stepText}>{tip}</Text>
              </View>
            ))}
          </View>
        );
      case 'story':
        return <Text style={s.storyText}>{stop.context}</Text>;
    }
  };

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        onScrollBeginDrag={skipAnimation}>
        {/* Phase 0: "You've Arrived" badge */}
        <Animated.View
          style={[
            s.arrivedBadge,
            {
              opacity: phase0,
              transform: [
                {
                  translateY: phase0.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}>
          <Text style={s.arrivedText}>You've Arrived</Text>
          <Text style={s.stopCounter}>
            Stop {stopNumber} of {totalStops}
          </Text>
        </Animated.View>

        {/* Phase 1: Emoji + Name + Subtitle */}
        <Animated.View style={{opacity: phase1}}>
          <Animated.Text
            style={[
              s.emoji,
              {transform: [{scale: emojiScale}]},
            ]}>
            {stop.revealEmoji}
          </Animated.Text>
        </Animated.View>

        <Animated.View
          style={{
            opacity: phase1,
            transform: [
              {
                translateY: phase1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }}>
          <Text style={s.stopName}>{stop.name}</Text>
          <Text style={s.stopSubtitle}>{stop.subtitle}</Text>
        </Animated.View>

        {/* Phase 2: Divider + Hook */}
        <Animated.View
          style={[
            s.dividerContainer,
            {
              opacity: phase2,
              transform: [
                {
                  scaleX: phase2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              ],
            },
          ]}>
          <View style={s.divider} />
        </Animated.View>

        <Animated.View
          style={{
            opacity: phase2,
            transform: [
              {
                translateY: phase2.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }}>
          <Text style={s.hookText}>{stop.hook}</Text>
        </Animated.View>

        {/* Phase 3: Practical strip + Tabs */}
        <Animated.View style={{opacity: phase3}}>
          {/* Practical strip */}
          <View style={s.practicalStrip}>
            <View style={s.practicalItem}>
              <Clock3 size={16} color="#d1d3dc" />
              <Text style={s.practicalText}>{stop.suggestedDuration}</Text>
            </View>
            <View style={s.practicalDivider} />
            <View style={s.practicalItem}>
              <DollarSign size={16} color="#d1d3dc" />
              <Text style={s.practicalText}>{stop.costNote}</Text>
            </View>
            <View style={s.practicalDivider} />
            <View style={s.practicalItem}>
              <Store size={16} color="#d1d3dc" />
              <Text style={s.practicalText}>{stop.hoursToday}</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={s.tabRow}>
            <TouchableOpacity
              style={[s.tab, activeTab === 'whatToDo' && s.tabActive]}
              onPress={() => setActiveTab('whatToDo')}>
              <Text
                style={[
                  s.tabText,
                  activeTab === 'whatToDo' && s.tabTextActive,
                ]}>
                What to Do
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, activeTab === 'proTips' && s.tabActive]}
              onPress={() => setActiveTab('proTips')}>
              <Text
                style={[
                  s.tabText,
                  activeTab === 'proTips' && s.tabTextActive,
                ]}>
                Pro Tips
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, activeTab === 'story' && s.tabActive]}
              onPress={() => setActiveTab('story')}>
              <Text
                style={[
                  s.tabText,
                  activeTab === 'story' && s.tabTextActive,
                ]}>
                The Story
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab content */}
          <View style={s.tabContent}>{renderTabContent()}</View>

          {/* Ready to Go button */}
          <TouchableOpacity style={s.readyButton} onPress={onReadyToGo}>
            <Text style={s.readyButtonText}>
              {isLastStop ? 'Finish Trip' : 'Ready to Go'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f1020',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Phase 0
  arrivedBadge: {
    alignSelf: 'center',
    backgroundColor: '#e94560',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 28,
  },
  arrivedText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
  stopCounter: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },

  // Phase 1
  emoji: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: 12,
  },
  stopName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  stopSubtitle: {
    color: '#d1d3dc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Phase 2
  dividerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  divider: {
    width: '60%',
    height: 1,
    backgroundColor: '#3a3f66',
  },
  hookText: {
    color: '#fff',
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },

  // Phase 3 — Practical strip
  practicalStrip: {
    flexDirection: 'row',
    backgroundColor: '#1f2237',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practicalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  practicalText: {
    color: '#d1d3dc',
    fontSize: 13,
    fontWeight: '600',
  },
  practicalDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#3a3f66',
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3f66',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#e94560',
  },
  tabText: {
    color: '#8b8ea3',
    fontWeight: '700',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabContent: {
    minHeight: 120,
    marginBottom: 24,
  },

  // What to Do steps
  stepRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingRight: 8,
  },
  stepNumber: {
    color: '#e94560',
    fontWeight: '800',
    fontSize: 15,
    width: 24,
  },
  bulletPoint: {
    color: '#e94560',
    fontWeight: '800',
    fontSize: 15,
    width: 24,
  },
  stepText: {
    color: '#d4d8ea',
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },

  // Story
  storyText: {
    color: '#d4d8ea',
    fontSize: 15,
    lineHeight: 24,
  },

  // Conditional blocks
  conditionalContainer: {
    marginTop: 16,
    gap: 10,
  },
  conditionalCard: {
    borderWidth: 1,
    borderColor: '#3a3f66',
    borderRadius: 10,
    padding: 12,
  },
  conditionalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  conditionalLabel: {
    color: '#e94560',
    fontWeight: '700',
    fontSize: 13,
  },
  conditionalText: {
    color: '#d4d8ea',
    fontSize: 14,
    lineHeight: 20,
  },

  // Ready to Go
  readyButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  readyButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
  },
});
