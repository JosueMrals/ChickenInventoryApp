import React from 'react';
import { View, StyleSheet } from 'react-native';
import StatCard from './StatCard';

// ponytail: estilos locales; el rediseño del dashboard eliminó statRow/statCardWrapper
// de dashboardStyles y las tarjetas quedaban con altura 0.
const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 10 },
  // El wrapper es fila para que el `flex: 1` de StatCard mida ancho y no alto:
  // en columna el flex lo dejaba con altura 0 y no se veia el contenido.
  statCardWrapper: { flexDirection: 'row', paddingHorizontal: 5 },
});

/**
 * Componente para renderizar una grilla de StatCards con un layout personalizable.
 * @param {object} props
 * @param {object} props.availableStats - Un objeto donde las llaves son los `key` de las estadísticas y los valores son los datos de la tarjeta (icon, color, title, value).
 * @param {Array<Array<object>>} props.layout - Un array de filas, donde cada fila es un array de objetos de configuración de tarjeta.
 *                                                Ej: [[{ key: 'products', size: 2 }, { key: 'lowStock', size: 1 }]]
 */
const StatCardGrid = ({ availableStats, layout }) => {
  if (!availableStats || !layout) {
    return null;
  }

  return (
    <>
      {layout.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.statRow}>
          {row.map((cardConfig) => {
            const stat = availableStats[cardConfig.key];
            if (!stat) return null;

            const cardContainerStyle = [
              styles.statCardWrapper,
              { flex: cardConfig.size || 1 },
            ];

            return (
              <View key={cardConfig.key} style={cardContainerStyle}>
                <StatCard
                  icon={stat.icon}
                  color={stat.color}
                  title={stat.title}
                  value={stat.value}
                />
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
};

export default StatCardGrid;
