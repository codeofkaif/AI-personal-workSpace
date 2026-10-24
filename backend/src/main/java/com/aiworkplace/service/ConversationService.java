package com.aiworkplace.service;

import com.aiworkplace.dto.request.MessageRequest;
import com.aiworkplace.dto.response.*;
import com.aiworkplace.entity.*;
import com.aiworkplace.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    public ConversationResponse createConversation(User user) {
        Conversation conv = Conversation.builder().user(user).build();
        conv = conversationRepository.save(conv);
        return toResponse(conv);
    }

    public List<ConversationResponse> getConversations(Long userId) {
        return conversationRepository.findByUserIdOrderByCreatedAtDesc(userId)
            .stream().map(this::toResponse).toList();
    }

    public List<MessageResponse> getMessages(Long convId) {
        return messageRepository.findByConversationIdOrderByCreatedAtAsc(convId)
            .stream().map(this::toMessageResponse).toList();
    }

    public MessageResponse addMessage(Long convId, String content, String sender) {
        Conversation conv = conversationRepository.findById(convId)
            .orElseThrow(() -> new RuntimeException("Conversation not found: " + convId));
        Message msg = Message.builder()
            .content(content).sender(sender).conversation(conv).build();
        return toMessageResponse(messageRepository.save(msg));
    }

    private ConversationResponse toResponse(Conversation c) {
        return ConversationResponse.builder()
            .id(c.getId()).createdAt(c.getCreatedAt()).build();
    }

    private MessageResponse toMessageResponse(Message m) {
        return MessageResponse.builder()
            .id(m.getId()).content(m.getContent()).sender(m.getSender()).createdAt(m.getCreatedAt()).build();
    }
}
