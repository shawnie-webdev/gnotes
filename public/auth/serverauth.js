// auth.js
import { supabase } from './supabase-client'

export async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    })

    if (error) {
        console.error('Sign up failed:', error.message)
        return null
    }

    const accessToken = data.session?.access_token
    console.log('User created:', data.user?.id)
    console.log('Session ID (Access Token):', accessToken)

    return accessToken
}

export async function logIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        console.error('Login failed:', error.message)
        return null
    }

    const accessToken = data.session.access_token
    console.log('Logged in successfully!')
    console.log('Session Token:', accessToken)

    return accessToken
}

export async function getSessionId() {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
        console.log('No active session found')
        return undefined
    }

    return session.access_token
}