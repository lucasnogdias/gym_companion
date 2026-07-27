import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createTrainingPlan,
  listTrainingPlans,
  setActiveTrainingPlan,
  type TrainingPlan,
} from './src/database';

export default function App() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [planName, setPlanName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    setError(null);
    try {
      setPlans(await listTrainingPlans());
    } catch (loadError) {
      setError(toErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  async function handleCreatePlan() {
    const name = planName.trim();
    if (!name) {
      setError('Enter a name for your training plan.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await createTrainingPlan(name);
      setPlanName('');
      await loadPlans();
    } catch (createError) {
      setError(toErrorMessage(createError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleActivatePlan(plan: TrainingPlan) {
    if (plan.isActive) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await setActiveTrainingPlan(plan.id);
      await loadPlans();
    } catch (activationError) {
      setError(toErrorMessage(activationError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>GYM COMPANION</Text>
        <Text style={styles.title}>Training plans</Text>
        <Text style={styles.subtitle}>
          Choose the plan you are following or create a new one.
        </Text>

        <View style={styles.createPlan}>
          <TextInput
            accessibilityLabel="Training plan name"
            autoCapitalize="sentences"
            onChangeText={setPlanName}
            onSubmitEditing={() => void handleCreatePlan()}
            placeholder="e.g. Push / Pull / Legs"
            placeholderTextColor="#78716C"
            returnKeyType="done"
            style={styles.input}
            value={planName}
          />
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => void handleCreatePlan()}
            style={({ pressed }) => [
              styles.createButton,
              (pressed || isSaving) && styles.buttonPressed,
            ]}
          >
            <Text style={styles.createButtonLabel}>Add plan</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isLoading ? (
          <ActivityIndicator color="#0F766E" size="large" style={styles.loader} />
        ) : plans.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No plans yet</Text>
            <Text style={styles.emptyStateText}>
              Create your first plan to start organizing your workouts.
            </Text>
          </View>
        ) : (
          <View style={styles.planList}>
            {plans.map((plan) => (
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                key={plan.id}
                onPress={() => void handleActivatePlan(plan)}
                style={({ pressed }) => [
                  styles.planCard,
                  plan.isActive && styles.activePlanCard,
                  (pressed || isSaving) && styles.buttonPressed,
                ]}
              >
                <View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planStatus}>
                    {plan.isActive ? 'Active plan' : 'Tap to make active'}
                  </Text>
                </View>
                {plan.isActive ? <Text style={styles.activeMark}>ACTIVE</Text> : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  eyebrow: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    color: '#1C1917',
    fontSize: 32,
    fontWeight: '700',
    marginTop: 8,
  },
  subtitle: {
    color: '#57534E',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 8,
  },
  createPlan: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 28,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D6D3D1',
    borderRadius: 12,
    borderWidth: 1,
    color: '#1C1917',
    flex: 1,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: '#0F766E',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  createButtonLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.65,
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
    marginTop: 12,
  },
  loader: {
    marginTop: 48,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E5E4',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    padding: 28,
  },
  emptyStateTitle: {
    color: '#1C1917',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyStateText: {
    color: '#57534E',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  planList: {
    gap: 12,
    marginTop: 24,
  },
  planCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E5E4',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 78,
    padding: 18,
  },
  activePlanCard: {
    borderColor: '#0F766E',
    borderWidth: 2,
  },
  planName: {
    color: '#1C1917',
    fontSize: 17,
    fontWeight: '700',
  },
  planStatus: {
    color: '#57534E',
    fontSize: 14,
    marginTop: 4,
  },
  activeMark: {
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to update your training plans.';
}
