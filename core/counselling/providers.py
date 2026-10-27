"""External services. Tokens, medical details and email codes are never logged."""
import os
import ssl
import smtplib
from email.message import EmailMessage
import httpx
import stripe
from fastapi import HTTPException


def stripe_client():
    key = os.getenv('STRIPE_SECRET_KEY', '')
    if not key or not os.getenv('COUNSELLING_STRIPE_WEBHOOK_SECRET'):
        raise HTTPException(503, 'Appointment payments are not available yet. Please contact support.')
    stripe.api_key = key
    return stripe


def send_verification(email, code):
    host = os.getenv('COUNSELLING_SMTP_HOST')
    sender = os.getenv('COUNSELLING_EMAIL_FROM')
    if not host or not sender:
        raise HTTPException(503, 'Email verification is not available yet. Please contact support.')
    message = EmailMessage()
    message['From'] = sender
    message['To'] = email
    message['Subject'] = 'Confirm your BioVerse email'
    message.set_content(f'Your BioVerse confirmation code is {code}. It expires in 15 minutes. If you did not request this, ignore this email.')
    try:
        port = int(os.getenv('COUNSELLING_SMTP_PORT', '587'))
        if port == 465:
            smtp = smtplib.SMTP_SSL(host, port, timeout=15, context=ssl.create_default_context())
        else:
            smtp = smtplib.SMTP(host, port, timeout=15)
            smtp.starttls(context=ssl.create_default_context())
        with smtp:
            username = os.getenv('COUNSELLING_SMTP_USER')
            if username:
                smtp.login(username, os.environ['COUNSELLING_SMTP_PASSWORD'])
            smtp.send_message(message)
    except Exception as exc:
        raise HTTPException(503, 'We could not send your verification email. Please try again later.') from exc


def meeting_url(booking_id, user_id, owner, starts, ends):
    key = os.getenv('DAILY_API_KEY')
    if not key:
        raise HTTPException(503, 'Video meetings are not configured yet. Please contact support.')
    room = 'bv-' + booking_id
    with httpx.Client(base_url='https://api.daily.co/v1', headers={'Authorization': f'Bearer {key}'}, timeout=15) as client:
        try:
            response = client.get('/rooms/' + room)
            if response.status_code == 404:
                response = client.post('/rooms', json={'name': room, 'privacy': 'private', 'properties': {
                    'nbf': starts - 600, 'exp': ends + 900, 'eject_at_room_exp': True,
                    'enable_recording': False, 'enable_prejoin_ui': True, 'max_participants': 2,
                    'enable_knocking': False, 'enable_transcription_storage': False,
                }})
                # Another authorised participant may have created this room concurrently.
                if response.status_code in (400, 409):
                    response = client.get('/rooms/' + room)
            response.raise_for_status()
            data = response.json()
            if data.get('privacy') != 'private':
                raise ValueError('Room must remain private')
            token = client.post('/meeting-tokens', json={'properties': {
                'room_name': room, 'user_id': user_id, 'is_owner': owner,
                'nbf': starts - 600, 'exp': ends + 900, 'eject_at_token_exp': True,
                'enable_recording': False, 'enable_recording_ui': False,
                'start_cloud_recording': False, 'auto_start_transcription': False,
            }})
            token.raise_for_status()
            url = data['url']
            if not url.startswith('https://') or not url.split('/')[2].endswith('.daily.co'):
                raise ValueError('Unexpected video host')
            return url + '?t=' + token.json()['token']
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            raise HTTPException(503, 'Unable to open your meeting. Please retry or contact support.') from exc
