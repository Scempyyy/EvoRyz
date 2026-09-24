import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card, Privacy } from '@/src/components/ui';
import { useApp } from '@/src/store/AppContext';
import { MealAnalysisService } from '@/src/services/mealAnalysis';
import { colors } from '@/src/theme';
import { Meal, Visibility } from '@/src/types';

const mealTypes: Meal['type'][] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export default function MealsScreen() {
  const router = useRouter();
  const { meals, addMeal, updateMeal, deleteMeal, workspace } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<Meal['type']>('Lunch');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [portion, setPortion] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [visibility, setVisibility] = useState<Visibility>('private');

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories || 0),
      protein: acc.protein + (m.protein || 0),
      carbs: acc.carbs + (m.carbs || 0),
      fat: acc.fat + (m.fat || 0),
      fiber: acc.fiber + (m.fiber || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  const resetForm = () => {
    setEditingMealId(null);
    setName('');
    setType('Lunch');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setFiber('');
    setPortion('');
    setNotes('');
    setPhotoUri(undefined);
    setVisibility('private');
  };

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (meal: Meal) => {
    setEditingMealId(meal.id);
    setName(meal.name);
    setType(meal.type);
    setCalories(String(meal.calories || 0));
    setProtein(String(meal.protein || 0));
    setCarbs(String(meal.carbs || 0));
    setFat(String(meal.fat || 0));
    setFiber(String(meal.fiber || 0));
    setPortion(meal.portion || '');
    setNotes(meal.notes || '');
    setPhotoUri(meal.photoUri);
    setVisibility(meal.visibility);
    setModalOpen(true);
  };

  const handlePickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please grant photo library access to attach meal photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (result.canceled || !result.assets[0]) return;

      const pickedUri = result.assets[0].uri;
      setPhotoUri(pickedUri);

      // Trigger AI estimation review seam
      setAnalyzing(true);
      try {
        const analysis = await MealAnalysisService.analyzePhoto(pickedUri, name);
        if (!name.trim()) setName(analysis.name);
        setCalories(String(analysis.calories));
        setProtein(String(analysis.protein));
        setCarbs(String(analysis.carbs));
        setFat(String(analysis.fat));
        setFiber(String(analysis.fiber));
        if (analysis.portion) setPortion(analysis.portion);
      } finally {
        setAnalyzing(false);
      }
    } catch (err) {
      console.warn('[MealsScreen] photo picker error:', err);
      setAnalyzing(false);
    }
  };

  const handleAiEstimate = async () => {
    if (!name.trim()) {
      Alert.alert('Meal Name Required', 'Please enter a meal name or dish description first.');
      return;
    }
    setAnalyzing(true);
    try {
      const analysis = await MealAnalysisService.estimateNutrition(name);
      setCalories(String(analysis.calories));
      setProtein(String(analysis.protein));
      setCarbs(String(analysis.carbs));
      setFat(String(analysis.fat));
      setFiber(String(analysis.fiber));
      if (analysis.portion) setPortion(analysis.portion);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveMeal = () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Required Field', 'Please enter a name for the meal.');
      return;
    }

    const mealData = {
      name: cleanName,
      type,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      fiber: Number(fiber) || 0,
      portion: portion.trim() || undefined,
      notes: notes.trim() || undefined,
      photoUri,
      visibility,
    };

    if (editingMealId) {
      const target = meals.find((m) => m.id === editingMealId);
      if (target) {
        updateMeal({
          ...target,
          ...mealData,
        });
      }
    } else {
      addMeal(mealData);
    }

    setModalOpen(false);
    resetForm();
  };

  const handleDeleteMeal = (mealId: string, mealName: string) => {
    Alert.alert('Delete Meal', `Remove "${mealName}" from your logged meals?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMeal(mealId),
      },
    ]);
  };

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Top Bar with Back Button */}
        <View style={s.topBar}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="white" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Nutrition & Meals</Text>
            <Text style={s.subTitle}>Track daily macros, calories, and meals</Text>
          </View>
        </View>

        {/* Hero Daily Nutrition Card */}
        <Card style={s.hero}>
          <View style={s.heroRow}>
            <View>
              <Text style={s.kicker}>TODAY&apos;S NUTRITION</Text>
              <Text style={s.calories}>
                {totals.calories} <Text style={s.unit}>kcal</Text>
              </Text>
            </View>
            <View style={s.mealCountBadge}>
              <Ionicons name="restaurant-outline" size={16} color={colors.violetLight} />
              <Text style={s.mealCountText}>
                {meals.length} meal{meals.length === 1 ? '' : 's'}
              </Text>
            </View>
          </View>

          {/* Macros Row */}
          <View style={s.macroSummaryRow}>
            <View style={s.macroBox}>
              <Text style={s.macroVal}>{totals.protein}g</Text>
              <Text style={s.macroLabel}>Protein</Text>
            </View>
            <View style={s.macroBox}>
              <Text style={s.macroVal}>{totals.carbs}g</Text>
              <Text style={s.macroLabel}>Carbs</Text>
            </View>
            <View style={s.macroBox}>
              <Text style={s.macroVal}>{totals.fat}g</Text>
              <Text style={s.macroLabel}>Fat</Text>
            </View>
            <View style={s.macroBox}>
              <Text style={s.macroVal}>{totals.fiber}g</Text>
              <Text style={s.macroLabel}>Fiber</Text>
            </View>
          </View>
        </Card>

        {/* Section Header */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>TODAY&apos;S LOGGED MEALS</Text>
          <Pressable style={s.addInlineBtn} onPress={openAddModal}>
            <Ionicons name="add" size={16} color={colors.violetLight} />
            <Text style={s.addInlineText}>Log Meal</Text>
          </Pressable>
        </View>

        {/* Meals List */}
        {meals.length ? (
          meals.map((m) => (
            <Card key={m.id} style={s.mealCard}>
              <View style={s.cardHeader}>
                {/* Photo Thumbnail if available */}
                {m.photoUri ? (
                  <Image source={{ uri: m.photoUri }} style={s.thumbnail} resizeMode="cover" />
                ) : (
                  <View style={s.thumbnailPlaceholder}>
                    <Ionicons name="fast-food-outline" size={20} color={colors.muted} />
                  </View>
                )}

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={s.mealNameRow}>
                    <Text style={s.mealName}>{m.name}</Text>
                    <Privacy value={m.visibility} />
                  </View>
                  <Text style={s.mealSub}>
                    {m.type} {m.portion ? `· ${m.portion}` : ''}
                  </Text>
                </View>

                {/* Edit & Delete Actions */}
                <View style={s.actionRow}>
                  <Pressable style={s.iconBtn} onPress={() => openEditModal(m)}>
                    <Ionicons name="pencil-outline" size={18} color="#A78BFA" />
                  </Pressable>
                  <Pressable style={s.iconBtn} onPress={() => handleDeleteMeal(m.id, m.name)}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </Pressable>
                </View>
              </View>

              {/* Calories & Macros Footer */}
              <View style={s.cardFooter}>
                <Text style={s.cardCalories}>{m.calories} kcal</Text>
                <View style={s.macroBadges}>
                  <Text style={s.badgeP}>P: {m.protein}g</Text>
                  <Text style={s.badgeC}>C: {m.carbs}g</Text>
                  <Text style={s.badgeF}>F: {m.fat}g</Text>
                  <Text style={s.badgeFib}>Fib: {m.fiber}g</Text>
                </View>
              </View>

              {m.notes ? <Text style={s.cardNotes}>{m.notes}</Text> : null}
            </Card>
          ))
        ) : (
          <View style={s.emptyContainer}>
            <Ionicons name="nutrition-outline" size={44} color="#332B45" />
            <Text style={s.emptyTitle}>No meals logged today</Text>
            <Text style={s.emptySub}>
              Log meals manually or analyze a photo with AI to automatically estimate macros.
            </Text>
            <Pressable style={s.emptyAction} onPress={openAddModal}>
              <Ionicons name="add" size={18} color="white" />
              <Text style={s.emptyActionText}>Log your first meal</Text>
            </Pressable>
          </View>
        )}

        <Text style={s.disclaimer}>
          Nutrition values and AI estimations are general approximations for tracking and are not
          clinical advice.
        </Text>
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable style={s.fab} onPress={openAddModal}>
        <Ionicons name="add" color="white" size={28} />
      </Pressable>

      {/* Modal Sheet for Add / Edit */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{editingMealId ? 'Edit Meal' : 'Log Meal'}</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Photo preview / selector */}
              <View style={s.photoSection}>
                {photoUri ? (
                  <View style={s.previewContainer}>
                    <Image source={{ uri: photoUri }} style={s.previewImage} resizeMode="cover" />
                    <Pressable style={s.changePhotoBtn} onPress={handlePickPhoto}>
                      <Ionicons name="camera-outline" size={14} color="white" />
                      <Text style={s.changePhotoText}>Change photo</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={s.pickPhotoBtn} onPress={handlePickPhoto} disabled={analyzing}>
                    {analyzing ? (
                      <ActivityIndicator size="small" color={colors.violetLight} />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={20} color={colors.violetLight} />
                        <Text style={s.pickPhotoText}>Attach photo & estimate macros</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>

              {/* Meal Name Input */}
              <Text style={s.inputLabel}>MEAL NAME / DISH</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g., Grilled Chicken Rice Bowl"
                placeholderTextColor={colors.muted}
                style={s.input}
              />

              {/* AI Estimation Trigger Button */}
              <Pressable
                style={s.aiEstimateBtn}
                onPress={handleAiEstimate}
                disabled={analyzing || !name.trim()}
              >
                {analyzing ? (
                  <ActivityIndicator size="small" color="#A78BFA" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#A78BFA" />
                    <Text style={s.aiEstimateText}>Estimate nutrition from name</Text>
                  </>
                )}
              </Pressable>

              {/* Meal Type Selection */}
              <Text style={s.inputLabel}>MEAL TYPE</Text>
              <View style={s.options}>
                {mealTypes.map((v) => (
                  <Pressable
                    key={v}
                    style={[s.option, type === v && s.selectedOption]}
                    onPress={() => setType(v)}
                  >
                    <Text style={[s.optionText, type === v && s.selectedOptionText]}>{v}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Calories & Portion Row */}
              <View style={s.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={s.inputLabel}>CALORIES (KCAL)</Text>
                  <TextInput
                    value={calories}
                    onChangeText={setCalories}
                    placeholder="e.g. 450"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.muted}
                    style={s.input}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={s.inputLabel}>PORTION (OPTIONAL)</Text>
                  <TextInput
                    value={portion}
                    onChangeText={setPortion}
                    placeholder="e.g. 1 bowl / 300g"
                    placeholderTextColor={colors.muted}
                    style={s.input}
                  />
                </View>
              </View>

              {/* Macro Grid Inputs */}
              <Text style={s.inputLabel}>MACRONUTRIENTS (GRAMS)</Text>
              <View style={s.macroGrid}>
                <View style={s.macroCol}>
                  <Text style={s.macroColLabel}>Protein</Text>
                  <TextInput
                    value={protein}
                    onChangeText={setProtein}
                    placeholder="0g"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.muted}
                    style={s.macroInput}
                  />
                </View>
                <View style={s.macroCol}>
                  <Text style={s.macroColLabel}>Carbs</Text>
                  <TextInput
                    value={carbs}
                    onChangeText={setCarbs}
                    placeholder="0g"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.muted}
                    style={s.macroInput}
                  />
                </View>
                <View style={s.macroCol}>
                  <Text style={s.macroColLabel}>Fat</Text>
                  <TextInput
                    value={fat}
                    onChangeText={setFat}
                    placeholder="0g"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.muted}
                    style={s.macroInput}
                  />
                </View>
                <View style={s.macroCol}>
                  <Text style={s.macroColLabel}>Fiber</Text>
                  <TextInput
                    value={fiber}
                    onChangeText={setFiber}
                    placeholder="0g"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.muted}
                    style={s.macroInput}
                  />
                </View>
              </View>

              {/* Notes Input */}
              <Text style={s.inputLabel}>NOTES (OPTIONAL)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Ingredients, timing, or feeling..."
                placeholderTextColor={colors.muted}
                style={[s.input, { height: 60 }]}
                multiline
              />

              {/* Privacy Setting if in workspace */}
              {workspace && (
                <View style={s.visibilityRow}>
                  <Text style={s.inputLabel}>PRIVACY</Text>
                  <Pressable
                    style={s.visibilityToggle}
                    onPress={() => setVisibility((v) => (v === 'private' ? 'shared' : 'private'))}
                  >
                    <Ionicons
                      name={visibility === 'private' ? 'lock-closed' : 'people'}
                      size={16}
                      color={visibility === 'private' ? '#C4B5FD' : colors.green}
                    />
                    <Text style={s.visibilityText}>
                      {visibility === 'private' ? 'Private to You' : 'Shared with Workspace'} (tap to
                      toggle)
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Action Buttons */}
              <Pressable style={s.saveBtn} onPress={handleSaveMeal}>
                <Text style={s.saveBtnText}>{editingMealId ? 'Update Meal' : 'Save Meal'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 18, paddingBottom: 110 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: '800' },
  subTitle: { color: colors.muted, fontSize: 13, marginTop: 2 },

  // Hero Card
  hero: { backgroundColor: '#1A162B', borderColor: '#2E2648', padding: 18, marginBottom: 20 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kicker: { color: colors.violetLight, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  calories: { color: 'white', fontSize: 36, fontWeight: '900', marginTop: 4 },
  unit: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  mealCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#272042',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  mealCountText: { color: '#E9D5FF', fontSize: 12, fontWeight: '700' },

  macroSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2B2344',
  },
  macroBox: { alignItems: 'center' },
  macroVal: { color: 'white', fontSize: 16, fontWeight: '800' },
  macroLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 3 },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  addInlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addInlineText: { color: colors.violetLight, fontSize: 13, fontWeight: '700' },

  // Meal Card
  mealCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
    borderRadius: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  thumbnail: { width: 48, height: 48, borderRadius: 10 },
  thumbnailPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealName: { color: 'white', fontWeight: '800', fontSize: 15, flex: 1, marginRight: 8 },
  mealSub: { color: colors.muted, fontSize: 12, marginTop: 3 },
  actionRow: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E1B2C',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#242131',
  },
  cardCalories: { color: 'white', fontSize: 14, fontWeight: '800' },
  macroBadges: { flexDirection: 'row', gap: 6 },
  badgeP: { color: '#93C5FD', fontSize: 11, fontWeight: '700' },
  badgeC: { color: '#FDE047', fontSize: 11, fontWeight: '700' },
  badgeF: { color: '#FCA5A5', fontSize: 11, fontWeight: '700' },
  badgeFib: { color: '#86EFAC', fontSize: 11, fontWeight: '700' },
  cardNotes: { color: colors.muted, fontSize: 12, marginTop: 8, fontStyle: 'italic' },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 10,
  },
  emptyTitle: { color: 'white', fontSize: 17, fontWeight: '800', marginTop: 14 },
  emptySub: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 20,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.violet,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyActionText: { color: 'white', fontSize: 14, fontWeight: '800' },

  disclaimer: {
    color: '#655E75',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 16,
    paddingHorizontal: 20,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },

  // Modal Sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#181522',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: { color: 'white', fontSize: 20, fontWeight: '800' },
  photoSection: { marginBottom: 16 },
  previewContainer: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: { width: '100%', height: '100%' },
  changePhotoBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  changePhotoText: { color: 'white', fontSize: 11, fontWeight: '700' },
  pickPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#231E33',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#362E4E',
    borderStyle: 'dashed',
  },
  pickPhotoText: { color: colors.violetLight, fontWeight: '700', fontSize: 13 },
  inputLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: colors.surface2,
    color: 'white',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  aiEstimateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#251F3A',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  aiEstimateText: { color: '#C4B5FD', fontSize: 12, fontWeight: '700' },
  options: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface2,
  },
  selectedOption: { backgroundColor: colors.violet },
  optionText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  selectedOptionText: { color: 'white' },
  formRow: { flexDirection: 'row', marginTop: 4 },
  macroGrid: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  macroCol: { flex: 1, alignItems: 'center' },
  macroColLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  macroInput: {
    width: '100%',
    backgroundColor: colors.surface2,
    color: 'white',
    borderRadius: 10,
    paddingVertical: 10,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 14,
  },
  visibilityRow: { marginTop: 6 },
  visibilityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface2,
    padding: 12,
    borderRadius: 10,
  },
  visibilityText: { color: 'white', fontSize: 13, fontWeight: '600' },
  saveBtn: {
    backgroundColor: colors.violet,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: 18,
  },
  saveBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
});
