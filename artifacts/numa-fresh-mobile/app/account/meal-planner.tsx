import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { useCart } from '@/contexts/CartContext';
import type { MealPlanResponse, MealPlanProductEntry, ServerError } from '@/lib/types';

const PLAN_TYPES = ['1-Day', '3-Day', 'Weekly', 'Monthly'];

const CUISINE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'South Asian', value: 'south_asian' },
  { label: 'Middle Eastern', value: 'middle_eastern' },
  { label: 'African', value: 'african' },
  { label: 'Mediterranean', value: 'mediterranean' },
  { label: 'American', value: 'american' },
];

const PROTEIN_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Chicken', value: 'chicken' },
  { label: 'Beef', value: 'beef' },
  { label: 'Lamb', value: 'lamb' },
  { label: 'Fish', value: 'fish' },
  { label: 'Goat', value: 'goat' },
  { label: 'Vegetarian', value: 'vegetarian' },
];

const PLAN_TYPE_MAP: Record<string, string> = {
  '1-Day': '1day',
  '3-Day': '3day',
  'Weekly': 'weekly',
  'Monthly': 'monthly',
};

export default function MealPlannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addItem, setStoreInfo } = useCart();

  const [planType, setPlanType] = useState('Weekly');
  const [budget, setBudget] = useState(100);
  const [familySize, setFamilySize] = useState(4);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(['south_asian']);
  const [selectedProteins, setSelectedProteins] = useState<string[]>(['chicken', 'beef']);
  const [planResponse, setPlanResponse] = useState<MealPlanResponse | null>(null);
  const [addedAll, setAddedAll] = useState(false);

  const toggleItem = (list: string[], item: string, setList: (v: string[]) => void) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const generatePlan = useMutation<MealPlanResponse, ServerError>({
    mutationFn: () =>
      api.post<MealPlanResponse>('/meal-planner/generate', {
        planType: PLAN_TYPE_MAP[planType] ?? 'weekly',
        budget,
        familySize,
        cuisineStyles: selectedCuisines,
        meatTypes: selectedProteins,
        dietaryRestrictions: [],
      }),
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPlanResponse(data);
      setAddedAll(false);
    },
    onError: (err) =>
      Alert.alert('Error', err?.response?.data?.message ?? err.message ?? 'Could not generate plan. Please try again.'),
  });

  const handleAddAll = () => {
    if (!planResponse) return;
    const { plan, productMap } = planResponse;
    let added = 0;
    let storeConflict = false;
    let firstStoreSet = false;

    for (const day of plan.days || []) {
      for (const meal of day.meals || []) {
        for (const ingredient of meal.ingredients || []) {
          const p: MealPlanProductEntry | undefined = productMap[ingredient.productId];
          if (!p) continue;

          const product = {
            id: p.id,
            name: p.name,
            price: p.price,
            category: p.category,
            storeId: p.storeId,
            storeSlug: p.storeSlug,
            store: { id: p.storeId, name: p.storeName, slug: p.storeSlug },
            images: p.images,
            isAvailable: true,
          };

          const qty = Math.max(1, Math.ceil(ingredient.quantity));
          const ok = addItem(product, qty);
          if (ok) {
            if (!firstStoreSet) {
              setStoreInfo(p.storeId, p.storeSlug, p.storeName);
              firstStoreSet = true;
            }
            added++;
          } else {
            storeConflict = true;
          }
        }
      }
    }

    setAddedAll(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (storeConflict) {
      Alert.alert(
        'Partial Add',
        `${added} item${added !== 1 ? 's' : ''} added. Some items were from a different store and couldn't be added to your current cart.`,
      );
    } else if (added > 0) {
      Alert.alert('Added!', `${added} item${added !== 1 ? 's' : ''} added to your cart.`);
    } else {
      Alert.alert('Nothing added', 'No products from this plan could be matched to the store catalog.');
    }
  };

  const s = styles(colors);
  const plan = planResponse?.plan ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        {/* Form */}
        {!plan && (
          <View>
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.foreground }]}>Plan Type</Text>
              <View style={s.chipRow}>
                {PLAN_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setPlanType(t)}
                    style={[s.chip, planType === t ? { backgroundColor: colors.primary } : { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }]}
                  >
                    <Text style={[s.chipText, { color: planType === t ? colors.card : colors.foreground }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.foreground }]}>Budget: ${budget}</Text>
              <Slider
                style={{ height: 40 }}
                minimumValue={20}
                maximumValue={500}
                step={10}
                value={budget}
                onValueChange={setBudget}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
              <View style={s.sliderLabels}>
                <Text style={[s.sliderLabel, { color: colors.mutedForeground }]}>$20</Text>
                <Text style={[s.sliderLabel, { color: colors.mutedForeground }]}>$500</Text>
              </View>
            </View>

            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.foreground }]}>Family Size: {familySize}</Text>
              <View style={s.stepperRow}>
                <TouchableOpacity
                  style={[s.stepperBtn, { backgroundColor: colors.muted }]}
                  onPress={() => setFamilySize(Math.max(1, familySize - 1))}
                >
                  <Ionicons name="remove" size={20} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={[s.stepperValue, { color: colors.foreground }]}>{familySize}</Text>
                <TouchableOpacity
                  style={[s.stepperBtn, { backgroundColor: colors.muted }]}
                  onPress={() => setFamilySize(Math.min(12, familySize + 1))}
                >
                  <Ionicons name="add" size={20} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.foreground }]}>Cuisine Preferences</Text>
              <View style={s.chipRow}>
                {CUISINE_OPTIONS.map(({ label, value }) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => toggleItem(selectedCuisines, value, setSelectedCuisines)}
                    style={[s.chip, selectedCuisines.includes(value) ? { backgroundColor: colors.primary } : { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }]}
                  >
                    <Text style={[s.chipText, { color: selectedCuisines.includes(value) ? colors.card : colors.foreground }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.foreground }]}>Protein Preferences</Text>
              <View style={s.chipRow}>
                {PROTEIN_OPTIONS.map(({ label, value }) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => toggleItem(selectedProteins, value, setSelectedProteins)}
                    style={[s.chip, selectedProteins.includes(value) ? { backgroundColor: colors.primary } : { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }]}
                  >
                    <Text style={[s.chipText, { color: selectedProteins.includes(value) ? colors.card : colors.foreground }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[s.generateBtn, { backgroundColor: colors.primary }]}
              onPress={() => generatePlan.mutate()}
              disabled={generatePlan.isPending || selectedCuisines.length === 0}
              activeOpacity={0.85}
            >
              {generatePlan.isPending ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color={colors.card} />
                  <Text style={[s.generateBtnText, { color: colors.card }]}>Generate Meal Plan</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Plan Display */}
        {plan && (
          <View>
            <View style={s.planHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[s.planTitle, { color: colors.foreground }]}>{plan.planTitle ?? `${planType} Meal Plan`}</Text>
                {plan.totalEstimatedCost != null && (
                  <Text style={[s.planCost, { color: colors.mutedForeground }]}>
                    Est. cost: ${plan.totalEstimatedCost.toFixed(2)}
                    {plan.budgetSavings != null && plan.budgetSavings > 0
                      ? ` · saves $${plan.budgetSavings.toFixed(2)}`
                      : ''}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setPlanResponse(null)} style={[s.regenerateBtn, { borderColor: colors.border }]}>
                <Ionicons name="refresh-outline" size={16} color={colors.foreground} />
                <Text style={[s.regenerateText, { color: colors.foreground }]}>New Plan</Text>
              </TouchableOpacity>
            </View>

            {plan.summary ? (
              <Text style={[s.planSummary, { color: colors.mutedForeground }]}>{plan.summary}</Text>
            ) : null}

            {(plan.days || []).map((day, dayIndex) => (
              <View key={dayIndex} style={[s.dayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.dayTitle, { color: colors.foreground }]}>
                  {day.dayLabel ?? `Day ${(day.dayNumber ?? dayIndex + 1)}`}
                </Text>
                {(day.meals || []).map((meal, mealIndex) => (
                  <View key={mealIndex} style={[s.mealSection, mealIndex > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Text style={[s.mealType, { color: colors.primary }]}>{meal.mealType ?? 'Meal'}</Text>
                    <Text style={[s.dishName, { color: colors.foreground }]}>{meal.name ?? ''}</Text>
                    {meal.description ? (
                      <Text style={[s.mealDesc, { color: colors.mutedForeground }]}>{meal.description}</Text>
                    ) : null}
                    <View style={s.ingredientsList}>
                      {(meal.ingredients || []).map((ing, ingIndex) => (
                        <View key={ingIndex} style={s.ingredientRow}>
                          <View style={[s.ingredientDot, { backgroundColor: colors.primary }]} />
                          <Text style={[s.ingredientText, { color: colors.mutedForeground }]}>
                            {ing.quantity} {ing.unit} {ing.productName}
                          </Text>
                          {ing.priceEach != null && (
                            <Text style={[s.ingredientPrice, { color: colors.mutedForeground }]}>
                              ${ing.totalPrice?.toFixed(2) ?? (ing.priceEach * ing.quantity).toFixed(2)}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                    {meal.estimatedCost != null && (
                      <Text style={[s.mealCost, { color: colors.mutedForeground }]}>Meal est. ${meal.estimatedCost.toFixed(2)}</Text>
                    )}
                  </View>
                ))}
              </View>
            ))}

            <TouchableOpacity
              style={[s.addAllBtn, { backgroundColor: addedAll ? colors.muted : colors.gold }]}
              onPress={handleAddAll}
              disabled={addedAll}
              activeOpacity={0.85}
            >
              <Ionicons name={addedAll ? 'checkmark-circle' : 'cart-outline'} size={20} color={addedAll ? colors.mutedForeground : colors.primaryDarker} />
              <Text style={[s.addAllText, { color: addedAll ? colors.mutedForeground : colors.primaryDarker }]}>
                {addedAll ? 'Added to Cart' : 'Add All Ingredients to Cart'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: '600' },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { fontSize: 12 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stepperBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontSize: 24, fontWeight: '800', minWidth: 40, textAlign: 'center' },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, height: 56, gap: 10, marginTop: 8,
  },
  generateBtnText: { fontSize: 17, fontWeight: '700' },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  planTitle: { fontSize: 20, fontWeight: '800' },
  planCost: { fontSize: 13, marginTop: 2 },
  planSummary: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  regenerateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 8 },
  regenerateText: { fontSize: 13, fontWeight: '600' },
  dayCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  dayTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  mealSection: { paddingTop: 12 },
  mealType: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  dishName: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  mealDesc: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  mealCost: { fontSize: 12, marginTop: 6, textAlign: 'right' },
  ingredientsList: { gap: 4 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ingredientDot: { width: 6, height: 6, borderRadius: 3 },
  ingredientText: { fontSize: 13, flex: 1 },
  ingredientPrice: { fontSize: 12 },
  addAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, height: 56, gap: 10, marginTop: 8,
  },
  addAllText: { fontSize: 16, fontWeight: '700' },
});
