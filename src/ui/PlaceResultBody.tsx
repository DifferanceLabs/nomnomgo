import { Image, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { PlaceCard, AppStyles } from '../../App';
import { useTheme } from './ThemeProvider';

type Props = {
  card: PlaceCard;
  resultMode: 'food' | 'activity';
  category: string;
  badge: string;
  imageUri?: string;
  isSelected: boolean;
  isSuggested: boolean;
  isDarkMode: boolean;
  styles: AppStyles;
  distanceText?: string;
  onDetails?: () => void;
};
export function PlaceResultBody({
  card,
  resultMode,
  category,
  badge,
  imageUri,
  isSelected,
  isSuggested,
  isDarkMode,
  styles,
  distanceText,
  onDetails,
}: Props) {
  const {
    theme: { colors },
  } = useTheme();
  return (
    <View style={styles.placeCardBody}>
      <View style={styles.placeCardMedia}>
        <TouchableOpacity
          style={styles.placeCardMediaTap}
          onPress={onDetails}
          accessibilityRole="button"
          disabled={!onDetails}
          accessible={!!onDetails}
          accessibilityLabel={onDetails ? `Open details for ${card.title}` : undefined}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.placeCardImage} resizeMode="cover" />
          ) : (
            <View style={[styles.placeCardImage, styles.placeCardImageFallback]}>
              <Ionicons
                name={
                  card.kind === 'event'
                    ? 'ticket-outline'
                    : resultMode === 'food'
                      ? 'restaurant-outline'
                      : 'sparkles-outline'
                }
                size={30}
                color={resultMode === 'food' ? colors.coral : colors.amber}
              />
            </View>
          )}
        </TouchableOpacity>
        {onDetails && (
          <TouchableOpacity
            style={styles.placeCardInfoTouchTarget}
            onPress={onDetails}
            accessibilityRole="button"
            accessibilityLabel={`Show information for ${card.title}`}
          >
            <View style={styles.placeCardInfoButton}>
              <Ionicons name="information-circle-outline" size={17} color={colors.textPrimary} />
            </View>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.placeCardContent}>
        <View style={styles.cardHeaderGrid}>
          <View style={styles.cardHeaderMain}>
            <Text style={[styles.cardRank, isSelected && styles.cardRankSelected]}>{badge}</Text>
            <Text
              style={[
                styles.cardTitle,
                isDarkMode && !(isSelected || isSuggested) && styles.darkText,
                (isSelected || isSuggested) && styles.cardTitleSelected,
              ]}
              numberOfLines={2}
            >
              {card.title}
            </Text>
          </View>
        </View>
        <Text
          style={[
            styles.cardCategory,
            resultMode === 'food' ? styles.cardCategoryFood : styles.cardCategoryActivity,
          ]}
          numberOfLines={1}
        >
          {category}
        </Text>
        <View style={styles.cardMetadataRow}>
          {typeof card.rating === 'number' ? (
            <View style={styles.cardMetadataPill}>
              <Ionicons name="star" size={13} color={colors.amber} />
              <Text style={styles.cardMetadataText}>
                {card.rating.toFixed(1)}
                {card.ratingCount ? ` (${card.ratingCount})` : ''}
              </Text>
            </View>
          ) : null}
          {distanceText ? (
            <View style={styles.cardMetadataPill}>
              <Ionicons name="navigate-outline" size={13} color={colors.teal} />
              <Text style={styles.cardMetadataText}>{distanceText}</Text>
            </View>
          ) : null}
          <Text
            style={[
              styles.cardHours,
              card.isOpen ? styles.open : card.isOpen === false ? styles.closed : styles.darkMutedText,
            ]}
            numberOfLines={1}
          >
            {card.kind === 'event' ? card.eventDateText || 'Date TBA' : card.hoursText || 'Hours unknown'}
          </Text>
        </View>
        {card.kind !== 'event' && card.operatingHours ? (
          <Text style={[styles.address, styles.darkMutedText]}>{card.operatingHours}</Text>
        ) : null}
        {card.kind !== 'event' && card.hoursWarning ? (
          <Text style={[styles.address, { color: colors.amber }]}>{card.hoursWarning}</Text>
        ) : null}
        {card.address ? (
          <Text style={[styles.address, styles.darkMutedText]} numberOfLines={2}>
            {card.address}
          </Text>
        ) : null}
        {card.eventAddressConflict ? (
          <Text style={[styles.address, styles.darkMutedText]}>
            Venue addresses differ between listings. Confirm on the event website.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
