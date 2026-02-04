import { StyleSheet } from "react-native";

const colors = {
  primary: '#4CAF50',
  secondary: '#FFC107',
  tertiary: '#F44336',
  quaternary: '#2196F3',
  background: '#F5F5F5',
  cardBackground: '#FFFFFF',
  text: '#333333',
  textSecondary: '#757575',
  borderColor: '#E0E0E0',
};

export default StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4, // Adjusted for better spacing
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
    padding: 10,
    borderRadius: 25,
  },
  textContainer: {
    // flex: 1, // This can cause text to wrap unnecessarily
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  value: {
    fontSize: 18, // Adjusted for a cleaner look
    fontWeight: "bold",
    color: colors.text,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.background,
  },
  // Specific background colors for icon containers
  incomeIcon: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  costIcon: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
  },
  profitIcon: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
  },
  salesIcon: {
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
  },
});
