package com.expressu

// Simple data model: a Post is a container (e.g., an Idea) with multiple entries (chapters)
data class Entry(
    val id: String,
    val title: String,
    val body: String,
    val mediaFiles: List<String> = emptyList(),
    val timestamp: Long = System.currentTimeMillis()
)

data class Post(
    val id: String,
    val section: String, // idea | hobby | moment | book | game
    val title: String,
    val entries: List<Entry> = emptyList()
)
