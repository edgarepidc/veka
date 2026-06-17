import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, ScreenHeader } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { FilterBar, TabStrip } from '@/components/ui/TabStrip';
import { Tag } from '@/components/ui/Tag';
import { useCommunity } from '@/hooks/useCommunity';
import { useMembership } from '@/hooks/useMembership';
import { useTheme } from '@/hooks/useTheme';

const REACTIONS = ['👍', '❤️', '😂', '🎉'];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function postTypeTag(type: string): { label: string; tone: 'green' | 'blue' | 'purple' | 'gray' } {
  if (type === 'poll') return { label: 'Encuesta', tone: 'purple' };
  if (type === 'photo') return { label: 'Foto', tone: 'blue' };
  if (type === 'announcement') return { label: 'Aviso', tone: 'green' };
  return { label: 'Post', tone: 'gray' };
}

export default function CommunityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { primary, loading: membershipLoading } = useMembership();
  const { posts, documents, loading, refreshing, refresh, toggleReaction, votePoll, canVoteFormalPolls } =
    useCommunity(primary);

  const [tab, setTab] = useState('feed');
  const [filter, setFilter] = useState('all');

  const filteredPosts = useMemo(() => {
    if (filter === 'all') return posts;
    return posts.filter((p) => p.post_type === filter);
  }, [filter, posts]);

  if (membershipLoading || loading) {
    return (
      <ScreenBackground style={styles.centered}>
        <ActivityIndicator size="large" color={theme.accent} />
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Comunidad" highlight="vecinal" subtitle={primary?.condominium?.name} />

        <View style={styles.section}>
          <TabStrip
            tabs={[
              { key: 'feed', label: 'Feed' },
              { key: 'docs', label: 'Documentos' },
            ]}
            active={tab}
            onChange={setTab}
          />

          {tab === 'feed' ? (
            <>
              <FilterBar
                items={[
                  { key: 'all', label: 'Todos' },
                  { key: 'announcement', label: 'Avisos' },
                  { key: 'poll', label: 'Encuestas' },
                  { key: 'photo', label: 'Fotos' },
                ]}
                active={filter}
                onChange={setFilter}
              />

              {filteredPosts.length === 0 ? (
                <GlassCard>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin publicaciones</Text>
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    Los avisos y encuestas de administración aparecerán aquí.
                  </Text>
                </GlassCard>
              ) : (
                filteredPosts.map((post) => {
                  const typeTag = postTypeTag(post.post_type);
                  const totalVotes = post.pollOptions?.reduce((sum, o) => sum + o.votes, 0) ?? 0;

                  return (
                    <GlassCard key={post.id} style={styles.postCard}>
                      <View style={styles.postHeader}>
                        <Avatar initials={post.author_initials} color={post.author_color} />
                        <View style={styles.postMeta}>
                          <Text style={[styles.postName, { color: theme.text }]}>{post.author_name}</Text>
                          <Text style={{ color: theme.textSubtle, fontSize: 10 }}>{timeAgo(post.created_at)}</Text>
                        </View>
                        <Tag label={typeTag.label} tone={typeTag.tone} />
                      </View>

                      {post.is_pinned ? (
                        <View style={[styles.pinned, { borderColor: `${theme.accent}44`, backgroundColor: `${theme.accent}11` }]}>
                          <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '700' }}>📌 FIJADO</Text>
                        </View>
                      ) : null}

                      <Text style={[styles.postTitle, { color: theme.text }]}>{post.title}</Text>
                      {post.body ? (
                        <Text style={[styles.postBody, { color: theme.textMuted }]}>{post.body}</Text>
                      ) : null}

                      {post.post_type === 'poll' && post.pollOptions ? (
                        <View style={styles.poll}>
                          {post.is_formal ? (
                            <Text style={{ color: theme.textSubtle, fontSize: 10, marginBottom: 6 }}>
                              Votación formal · solo residente propietario
                            </Text>
                          ) : null}
                          {post.pollOptions.map((opt) => {
                            const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                            const voted = post.myVote === opt.id;
                            const pollLocked = post.is_formal && !canVoteFormalPolls;
                            return (
                              <Pressable
                                key={opt.id}
                                disabled={!!post.myVote || pollLocked}
                                onPress={() => void votePoll(post.id, opt.id)}
                                style={[
                                  styles.pollOption,
                                  {
                                    borderColor: voted ? theme.accent : theme.glassBorder,
                                    backgroundColor: voted ? `${theme.accent}18` : theme.glassDeep,
                                  },
                                ]}
                              >
                                <View style={[styles.pollBar, { width: `${pct}%`, backgroundColor: `${theme.accent}33` }]} />
                                <View style={styles.pollRow}>
                                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600', flex: 1 }}>
                                    {opt.label}
                                  </Text>
                                  <Text style={{ color: theme.textSubtle, fontSize: 11 }}>{pct}%</Text>
                                </View>
                              </Pressable>
                            );
                          })}
                          {post.is_formal && !canVoteFormalPolls && !post.myVote ? (
                            <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 4 }}>
                              Como residente inquilino puedes ver resultados, pero no votar en encuestas formales.
                            </Text>
                          ) : null}
                          <Text style={{ color: theme.textSubtle, fontSize: 10, marginTop: 4 }}>
                            {totalVotes} voto{totalVotes === 1 ? '' : 's'}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.reactions}>
                        {REACTIONS.map((emoji) => {
                          const count = post.reactions[emoji] ?? 0;
                          const active = post.myReactions.includes(emoji);
                          return (
                            <Pressable
                              key={emoji}
                              onPress={() => void toggleReaction(post.id, emoji)}
                              style={[
                                styles.rxnBtn,
                                {
                                  backgroundColor: active ? `${theme.accent}22` : theme.glassDeep,
                                  borderColor: active ? `${theme.accent}55` : theme.glassBorder,
                                },
                              ]}
                            >
                              <Text style={{ fontSize: 12 }}>{emoji}</Text>
                              {count > 0 ? (
                                <Text style={{ color: active ? theme.accent : theme.textMuted, fontSize: 11 }}>
                                  {count}
                                </Text>
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    </GlassCard>
                  );
                })
              )}
            </>
          ) : (
            <GlassCard noPadding>
              {documents.length === 0 ? (
                <View style={{ padding: 16 }}>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin documentos</Text>
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    Reglamentos, minutas y estados de cuenta aparecerán aquí.
                  </Text>
                </View>
              ) : (
                documents.map((doc, index) => (
                  <Pressable
                    key={doc.id}
                    onPress={() => void Linking.openURL(doc.file_url)}
                    style={[
                      styles.docRow,
                      index < documents.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.glassBorder },
                    ]}
                  >
                    <View style={[styles.docIcon, { backgroundColor: `${theme.accent3}22` }]}>
                      <Text style={{ fontSize: 20 }}>📄</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.docTitle, { color: theme.text }]}>{doc.title}</Text>
                      <Text style={{ color: theme.textSubtle, fontSize: 10 }}>{doc.category}</Text>
                    </View>
                    <Text style={{ color: theme.accent2, fontSize: 16 }}>›</Text>
                  </Pressable>
                ))
              )}
            </GlassCard>
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: {},
  section: { paddingHorizontal: 20 },
  postCard: { marginBottom: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  postMeta: { flex: 1 },
  postName: { fontSize: 13, fontWeight: '600' },
  pinned: { alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 },
  postTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  postBody: { fontSize: 13, lineHeight: 20, marginBottom: 10 },
  poll: { gap: 8, marginBottom: 12 },
  pollOption: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', padding: 10 },
  pollBar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  pollRow: { flexDirection: 'row', alignItems: 'center' },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rxnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 13, marginTop: 6, lineHeight: 20 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  docIcon: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  docTitle: { fontSize: 13, fontWeight: '600' },
});
