import React from 'react';
import { View } from 'react-native';
import StatCard from './StatCard';
import styles from '../styles/dashboardStyles';

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
