import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  computePollQuorumResult,
  formatClusterScopeLabel,
  isImageStoragePath,
  isPollClosed,
  POLL_DEBT_MESSAGE,
  pollCloseLabel,
  type ClusterRef,
} from '@veka/shared';

import { Avatar, ScreenHeader } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { FilterBar, TabStrip } from '@/components/ui/TabStrip';
import { Tag } from '@/components/ui/Tag';
import type { SurfaceAccentTone } from '@/constants/surface';
import { useCommunity } from '@/hooks/useCommunity';
import { useMembership } from '@/hooks/useMembership';
import { useCommunityNotifications } from '@/providers/CommunityNotificationsProvider';
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

function postAccent(type: string, pinned: boolean): SurfaceAccentTone {
  if (pinned) return 'green';
  if (type === 'poll') return 'purple';
  if (type === 'announcement') return 'green';
  if (type === 'photo') return 'blue';
  return 'orange';
}

function docAccent(category: string): SurfaceAccentTone {
  const value = category.toLowerCase();
  if (value.includes('reglamento')) return 'blue';
  if (value.includes('minuta')) return 'purple';
  if (value.includes('estado')) return 'green';
  return 'orange';
}

function scopeTagTone(clusters: ClusterRef[]): 'gray' | 'blue' {
  return clusters.length === 0 ? 'gray' : 'blue';
}

export default function CommunityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { primary, loading: membershipLoading } = useMembership();
  const { posts, documents, loading, refreshing, refresh, toggleReaction, votePoll, addComment, canVoteInPost, hasOutstandingDebt } =
    useCommunity(primary);
  const { notifications, unreadCount, markRead, markAllRead } = useCommunityNotifications();
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const postIdParam = Array.isArray(params.postId) ? params.postId[0] : params.postId;

  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const postRefs = useRef<Record<string, View | null>>({});

  const [tab, setTab] = useState('feed');
  const [filter, setFilter] = useState('all');
  const [showInbox, setShowInbox] = useState(false);
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);
  const [scrollToPostId, setScrollToPostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [sendingComment, setSendingComment] = useState<Record<string, boolean>>({});

  function openPost(postId: string) {
    const post = posts.find((item) => item.id === postId);
    setTab('feed');
    if (post?.post_type === 'poll') setFilter('poll');
    else if (post?.post_type === 'photo') setFilter('photo');
    else if (post?.post_type === 'announcement') setFilter('announcement');
    else setFilter('all');
    setShowInbox(false);
    setScrollToPostId(postId);
  }

  useEffect(() => {
    if (postIdParam) setScrollToPostId(postIdParam);
  }, [postIdParam]);

  useEffect(() => {
    if (!scrollToPostId || loading) return;
    if (!posts.some((item) => item.id === scrollToPostId)) return;

    const timer = setTimeout(() => {
      const postView = postRefs.current[scrollToPostId];
      const content = contentRef.current;
      if (!postView || !content) return;

      postView.measureLayout(
        content,
        (_x, y) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
          setHighlightPostId(scrollToPostId);
          setScrollToPostId(null);
          setTimeout(() => setHighlightPostId(null), 2500);
        },
        () => undefined,
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [scrollToPostId, loading, posts]);

  function confirmVote(postId: string, optionId: string, label: string) {
    Alert.alert('Confirmar voto', `¿Registrar tu voto por "${label}"? No podrás cambiarlo después.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Votar',
        onPress: () => {
          void votePoll(postId, optionId).then((result) => {
            if (result.error) Alert.alert('No se pudo votar', result.error);
          });
        },
      },
    ]);
  }

  async function submitComment(postId: string) {
    const body = (commentDrafts[postId] ?? '').trim();
    if (!body || sendingComment[postId]) return;

    setSendingComment((current) => ({ ...current, [postId]: true }));
    try {
      const result = await addComment(postId, body);
      if (result.error) {
        Alert.alert('Comentario', result.error);
        return;
      }
      setCommentDrafts((current) => ({ ...current, [postId]: '' }));
    } finally {
      setSendingComment((current) => ({ ...current, [postId]: false }));
    }
  }

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
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View ref={contentRef} collapsable={false}>
        <ScreenHeader title="Comunidad" highlight="vecinal" subtitle={primary?.condominium?.name} />

        {unreadCount > 0 ? (
          <View style={styles.section}>
            <Pressable
              onPress={() => setShowInbox((value) => !value)}
              style={[
                styles.inboxToggle,
                { backgroundColor: `${theme.accent}18`, borderColor: `${theme.accent}44` },
              ]}
            >
              <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>
                {showInbox ? 'Ocultar notificaciones' : `${unreadCount} notificación${unreadCount === 1 ? '' : 'es'} nueva${unreadCount === 1 ? '' : 's'}`}
              </Text>
            </Pressable>
            {showInbox ? (
              <GlassCard style={{ marginTop: 10 }}>
                <View style={styles.inboxHeader}>
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>Bandeja</Text>
                  <Pressable onPress={() => void markAllRead()}>
                    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>Marcar todo leído</Text>
                  </Pressable>
                </View>
                {notifications.slice(0, 8).map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      void markRead(item.id);
                      if (item.entity_id) openPost(item.entity_id);
                    }}
                    style={[
                      styles.inboxItem,
                      {
                        borderColor: theme.glassBorder,
                        backgroundColor: item.read_at ? 'transparent' : `${theme.accent}11`,
                      },
                    ]}
                  >
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: item.read_at ? '500' : '700' }}>
                      {item.title}
                    </Text>
                    {item.body ? (
                      <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                        {item.body}
                      </Text>
                    ) : null}
                    <Text style={{ color: theme.textSubtle, fontSize: 10, marginTop: 4 }}>{timeAgo(item.created_at)}</Text>
                  </Pressable>
                ))}
              </GlassCard>
            ) : null}
          </View>
        ) : null}

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
                  const accent = postAccent(post.post_type, post.is_pinned);
                  const totalVotes = post.pollOptions?.reduce((sum, o) => sum + o.votes, 0) ?? 0;
                  const pollClosed = post.post_type === 'poll' && isPollClosed(post);
                  const closeLabel = post.post_type === 'poll' ? pollCloseLabel(post) : null;
                  const quorumResult =
                    post.post_type === 'poll' && post.pollOptions
                      ? computePollQuorumResult({
                          options: post.pollOptions,
                          totalVotes,
                          eligibleVoters: post.eligibleVoters,
                          quorumPercent: post.quorum_percent,
                          isFormal: post.is_formal,
                          isClosed: pollClosed,
                        })
                      : null;

                  return (
                    <View
                      key={post.id}
                      ref={(node) => {
                        postRefs.current[post.id] = node;
                      }}
                      collapsable={false}
                    >
                    <GlassCard
                      variant="accent"
                      accent={accent}
                      style={[
                        styles.postCard,
                        highlightPostId === post.id
                          ? { borderColor: theme.accent, borderWidth: 2 }
                          : undefined,
                      ]}
                    >
                      <View style={styles.postHeader}>
                        <Avatar initials={post.author_initials} color={post.author_color} />
                        <View style={styles.postMeta}>
                          <Text style={[styles.postName, { color: theme.text }]}>{post.author_name}</Text>
                          <Text style={{ color: theme.textSubtle, fontSize: 10 }}>{timeAgo(post.created_at)}</Text>
                        </View>
                        <Tag label={typeTag.label} tone={typeTag.tone} />
                      </View>

                      <View style={styles.scopeRow}>
                        <Tag label={formatClusterScopeLabel(post.clusters)} tone={scopeTagTone(post.clusters)} />
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

                      {post.image_url ? (
                        isImageStoragePath(post.image_url) ? (
                          <Pressable onPress={() => void Linking.openURL(post.image_url!)}>
                            <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" />
                          </Pressable>
                        ) : (
                          <Pressable
                            onPress={() => void Linking.openURL(post.image_url!)}
                            style={[styles.attachmentBtn, { borderColor: theme.glassBorder, backgroundColor: theme.glassDeep }]}
                          >
                            <Text style={{ fontSize: 18 }}>📄</Text>
                            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>Abrir adjunto PDF</Text>
                          </Pressable>
                        )
                      ) : null}

                      {post.post_type === 'poll' && closeLabel ? (
                        <Text
                          style={{
                            color: pollClosed ? theme.danger : theme.textSubtle,
                            fontSize: 11,
                            marginBottom: 8,
                          }}
                        >
                          {closeLabel}
                        </Text>
                      ) : null}

                      {post.post_type === 'poll' && post.pollOptions ? (
                        <View style={styles.poll}>
                          {pollClosed ? (
                            <View
                              style={[
                                styles.debtBanner,
                                { backgroundColor: `${theme.textSubtle}12`, borderColor: `${theme.textSubtle}33` },
                              ]}
                            >
                              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                                Esta encuesta ya no acepta votos. Solo puedes ver resultados.
                              </Text>
                            </View>
                          ) : null}
                          {post.is_formal ? (
                            <Text style={{ color: theme.textSubtle, fontSize: 10, marginBottom: 6 }}>
                              Votación formal · solo residente propietario
                            </Text>
                          ) : null}
                          {post.require_payment_current ? (
                            <Text style={{ color: theme.textSubtle, fontSize: 10, marginBottom: 6 }}>
                              Solo unidades al corriente de pagos
                            </Text>
                          ) : null}
                          {post.require_payment_current && hasOutstandingDebt && !post.myVote ? (
                            <View
                              style={[
                                styles.debtBanner,
                                { backgroundColor: `${theme.danger}12`, borderColor: `${theme.danger}33` },
                              ]}
                            >
                              <Text style={{ color: theme.danger, fontSize: 12, lineHeight: 18, flex: 1 }}>
                                {POLL_DEBT_MESSAGE}
                              </Text>
                              <Pressable onPress={() => router.push('/finance')} style={styles.debtLink}>
                                <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>Ir a Finanzas</Text>
                              </Pressable>
                            </View>
                          ) : null}
                          {quorumResult ? (
                            <Text
                              style={{
                                color:
                                  quorumResult.statusTone === 'success'
                                    ? theme.success
                                    : quorumResult.statusTone === 'warning'
                                      ? theme.warning
                                      : theme.textSubtle,
                                fontSize: 11,
                                marginBottom: 6,
                              }}
                            >
                              {quorumResult.statusLabel}
                            </Text>
                          ) : null}
                          {post.pollOptions.map((opt) => {
                            const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                            const voted = post.myVote === opt.id;
                            const pollLocked = pollClosed || !canVoteInPost(post) || !!post.myVote;
                            return (
                              <Pressable
                                key={opt.id}
                                disabled={pollLocked}
                                onPress={() => confirmVote(post.id, opt.id, opt.label)}
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
                          {post.is_formal && primary?.unit_relationship === 'tenant' && !post.myVote ? (
                            <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 4 }}>
                              Como residente inquilino puedes ver resultados, pero no votar en encuestas formales.
                            </Text>
                          ) : null}
                          <Text style={{ color: theme.textSubtle, fontSize: 10, marginTop: 4 }}>
                            {totalVotes} voto{totalVotes === 1 ? '' : 's'}
                          </Text>
                        </View>
                      ) : null}

                      {post.post_type === 'announcement' || post.post_type === 'photo' ? (
                        <View style={styles.comments}>
                          <Text style={{ color: theme.textSubtle, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
                            COMENTARIOS ({post.comments.length})
                          </Text>
                          {post.comments.map((comment) => (
                            <View key={comment.id} style={[styles.commentRow, { borderColor: theme.glassBorder }]}>
                              <Avatar initials={comment.author_initials} color={comment.author_color} size={28} />
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>
                                  {comment.author_name}
                                </Text>
                                <Text style={{ color: theme.textMuted, fontSize: 12, lineHeight: 18 }}>
                                  {comment.body}
                                </Text>
                                <Text style={{ color: theme.textSubtle, fontSize: 10, marginTop: 2 }}>
                                  {timeAgo(comment.created_at)}
                                </Text>
                              </View>
                            </View>
                          ))}
                          <View style={[styles.commentComposer, { borderColor: theme.glassBorder, backgroundColor: theme.glassDeep }]}>
                            <TextInput
                              value={commentDrafts[post.id] ?? ''}
                              onChangeText={(value) =>
                                setCommentDrafts((current) => ({ ...current, [post.id]: value }))
                              }
                              placeholder="Escribe un comentario…"
                              placeholderTextColor={theme.textSubtle}
                              style={{ flex: 1, color: theme.text, fontSize: 13, paddingVertical: 8 }}
                              multiline
                            />
                            <Pressable
                              onPress={() => void submitComment(post.id)}
                              disabled={!((commentDrafts[post.id] ?? '').trim()) || sendingComment[post.id]}
                              style={[
                                styles.commentSend,
                                {
                                  backgroundColor:
                                    !((commentDrafts[post.id] ?? '').trim()) || sendingComment[post.id]
                                      ? theme.textSubtle
                                      : theme.accent,
                                },
                              ]}
                            >
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                                {sendingComment[post.id] ? 'Enviando…' : 'Enviar'}
                              </Text>
                            </Pressable>
                          </View>
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
                    </View>
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
                documents.map((doc) => (
                  <GlassCard
                    key={doc.id}
                    variant="accent"
                    accent={docAccent(doc.category)}
                    style={styles.docCard}
                  >
                    <Pressable onPress={() => void Linking.openURL(doc.file_url)} style={styles.docRowInner}>
                      <View style={[styles.docIcon, { backgroundColor: `${theme.accent3}22` }]}>
                        <Text style={{ fontSize: 20 }}>📄</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.docTitle, { color: theme.text }]}>{doc.title}</Text>
                        <View style={styles.docMeta}>
                          <Text style={{ color: theme.textSubtle, fontSize: 10 }}>{doc.category}</Text>
                          <Tag label={formatClusterScopeLabel(doc.clusters)} tone={scopeTagTone(doc.clusters)} />
                        </View>
                      </View>
                      <Text style={{ color: theme.accent2, fontSize: 16 }}>›</Text>
                    </Pressable>
                  </GlassCard>
                ))
              )}
            </GlassCard>
          )}
        </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: {},
  section: { paddingHorizontal: 20 },
  inboxToggle: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  inboxItem: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  postCard: { marginBottom: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  postMeta: { flex: 1 },
  scopeRow: { marginBottom: 8 },
  postName: { fontSize: 13, fontWeight: '600' },
  pinned: { alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 },
  postTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  postBody: { fontSize: 13, lineHeight: 20, marginBottom: 10 },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  attachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  poll: { gap: 8, marginBottom: 12 },
  pollOption: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', padding: 10 },
  pollBar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  pollRow: { flexDirection: 'row', alignItems: 'center' },
  debtBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
    gap: 8,
  },
  debtLink: { alignSelf: 'flex-start' },
  comments: { marginBottom: 12 },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  commentSend: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
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
  docCard: { marginBottom: 10 },
  docRowInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  docIcon: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  docTitle: { fontSize: 13, fontWeight: '600' },
  docMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 },
});
