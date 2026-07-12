import React from 'react';
import { View, Text } from 'react-native';
import sectionStyles from '../styles/InfoSectionStyles';
import dashboardStyles from '../styles/dashboardStyles';

export default function InfoSection({ title, children }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  if (rows.length === 0) return null;

  return (
    <View style={dashboardStyles.sectionWrapper}>
      {title && <Text style={dashboardStyles.sectionLabel}>{title}</Text>}
      <View style={sectionStyles.section}>
        {rows.map((row, index) => (
          <React.Fragment key={row.key ?? index}>
            {row}
            {index < rows.length - 1 && <View style={sectionStyles.rowDivider} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}
