import { useMemo, type MutableRefObject } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  MAX_COMMENT_DEPTH,
  buildCommentTree,
  flattenCommentTree,
} from '@veka/shared';

import { Avatar } from '@/components/ui/Avatar';
import type { PostComment } from '@/hooks/useCommunity';
import type { AppTheme } from '@/constants/theme';

const INDENT = 14;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function draftKey(postId: string, parentId: string | null) {
  return parentId ? `${postId}:${parentId}` : postId;
}

export function CommentThread({
  postId,
  comments,
  currentUserId,
  theme,
  commentDrafts,
  replyDrafts,
  sendingComment,
  onChangeDraft,
  onChangeReplyDraft,
  onSubmit,
  onSubmitReply,
  onDelete,
  onReply,
  replyingToId,
  highlightCommentId,
  commentRefs,
}: {
  postId: string;
  comments: PostComment[];
  currentUserId?: string;
  theme: AppTheme;
  commentDrafts: Record<string, string>;
  replyDrafts: Record<string, string>;
  sendingComment: Record<string, boolean>;
  onChangeDraft: (postId: string, value: string) => void;
  onChangeReplyDraft: (key: string, value: string) => void;
  onSubmit: (postId: string) => void;
  onSubmitReply: (postId: string, parentId: string) => void;
  onDelete: (commentId: string) => void;
  onReply: (commentId: string | null) => void;
  replyingToId: string | null;
  highlightCommentId?: string | null;
  commentRefs?: MutableRefObject<Record<string, View | null>>;
}) {
  const threaded = useMemo(() => flattenCommentTree(buildCommentTree(comments)), [comments]);

  function confirmDelete(commentId: string) {
    Alert.alert('Eliminar comentario', '¿Quieres eliminar tu comentario? También se quitarán sus respuestas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void onDelete(commentId),
      },
    ]);
  }

  return (
    <View style={styles.comments}>
      <Text style={{ color: theme.textSubtle, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
        COMENTARIOS ({comments.length})
      </Text>

      {threaded.map(({ comment, depth }) => {
        const canReply = depth + 1 < MAX_COMMENT_DEPTH;
        const isOwn = comment.author_id === currentUserId;
        const replyKey = draftKey(postId, comment.id);
        const isReplying = replyingToId === comment.id;

        return (
          <View
            key={comment.id}
            ref={(node) => {
              if (commentRefs) commentRefs.current[comment.id] = node;
            }}
            collapsable={false}
            style={{ marginLeft: depth * INDENT, marginBottom: 8 }}
          >
            <View
              style={[
                styles.commentRow,
                {
                  borderColor: highlightCommentId === comment.id ? theme.accent : theme.glassBorder,
                  backgroundColor: highlightCommentId === comment.id ? `${theme.accent}14` : 'transparent',
                },
              ]}
            >
              <Avatar initials={comment.author_initials} color={comment.author_color} size={28} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>{comment.author_name}</Text>
                <Text style={{ color: theme.textMuted, fontSize: 12, lineHeight: 18 }}>{comment.body}</Text>
                <View style={styles.commentActions}>
                  <Text style={{ color: theme.textSubtle, fontSize: 10 }}>{timeAgo(comment.created_at)}</Text>
                  {canReply ? (
                    <Pressable onPress={() => onReply(isReplying ? null : comment.id)} hitSlop={8}>
                      <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '600' }}>
                        {isReplying ? 'Cancelar' : 'Responder'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {isOwn ? (
                    <Pressable onPress={() => confirmDelete(comment.id)} hitSlop={8}>
                      <Text style={{ color: '#f87171', fontSize: 11, fontWeight: '600' }}>Eliminar</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>

            {isReplying ? (
              <View
                style={[
                  styles.commentComposer,
                  {
                    borderColor: theme.glassBorder,
                    backgroundColor: theme.glassDeep,
                    marginTop: 8,
                    marginLeft: 4,
                  },
                ]}
              >
                <TextInput
                  value={replyDrafts[replyKey] ?? ''}
                  onChangeText={(value) => onChangeReplyDraft(replyKey, value)}
                  placeholder="Escribe una respuesta…"
                  placeholderTextColor={theme.textSubtle}
                  style={{ flex: 1, color: theme.text, fontSize: 13, paddingVertical: 8 }}
                  multiline
                  autoFocus
                />
                <Pressable
                  onPress={() => onSubmitReply(postId, comment.id)}
                  disabled={!((replyDrafts[replyKey] ?? '').trim()) || sendingComment[replyKey]}
                  style={[
                    styles.commentSend,
                    {
                      backgroundColor:
                        !((replyDrafts[replyKey] ?? '').trim()) || sendingComment[replyKey]
                          ? theme.textSubtle
                          : theme.accent,
                    },
                  ]}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                    {sendingComment[replyKey] ? 'Enviando…' : 'Responder'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={[styles.commentComposer, { borderColor: theme.glassBorder, backgroundColor: theme.glassDeep }]}>
        <TextInput
          value={commentDrafts[postId] ?? ''}
          onChangeText={(value) => onChangeDraft(postId, value)}
          placeholder="Escribe un comentario…"
          placeholderTextColor={theme.textSubtle}
          style={{ flex: 1, color: theme.text, fontSize: 13, paddingVertical: 8 }}
          multiline
        />
        <Pressable
          onPress={() => onSubmit(postId)}
          disabled={!((commentDrafts[postId] ?? '').trim()) || sendingComment[postId]}
          style={[
            styles.commentSend,
            {
              backgroundColor:
                !((commentDrafts[postId] ?? '').trim()) || sendingComment[postId]
                  ? theme.textSubtle
                  : theme.accent,
            },
          ]}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
            {sendingComment[postId] ? 'Enviando…' : 'Enviar'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  comments: { marginBottom: 12 },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  commentSend: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
});
