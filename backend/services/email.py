"""
Flourish transactional email service -- powered by Resend.

All public functions are async and return bool (True = sent, False = failed).
Every send is wrapped in try/except so a failed email never breaks the caller.

Usage:
    from services.email import send_welcome_email
    await send_welcome_email(to="user@example.com", name="Sarah")
"""

import asyncio
import logging
import os

import resend

logger = logging.getLogger(__name__)

FROM_ADDRESS = "Flourish <hello@mail.theflourishapp.health>"
REPLY_TO = "hello@theflourishapp.health"
FRONTEND_URL = "https://theflourishapp.netlify.app"

# -- Brand colours -------------------------------------------------------------
PURPLE      = "#534AB7"
PURPLE_DARK = "#3d3488"
GREEN       = "#639922"
BG          = "#F8F7FF"
TEXT        = "#1A1A24"
TEXT_MUTED  = "#6B6A7C"
WHITE       = "#ffffff"

# -- Core send -----------------------------------------------------------------

def _send_sync(to: str, subject: str, html: str) -> bool:
    """Synchronous Resend call -- always run via asyncio.to_thread."""
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        logger.warning("[email] RESEND_API_KEY not set -- email not sent")
        return False
    resend.api_key = api_key
    response = resend.Emails.send({
        "from": FROM_ADDRESS,
        "to": [to],
        "reply_to": REPLY_TO,
        "subject": subject,
        "html": html,
    })
    return bool(response and response.get("id"))


async def send_email(to: str, subject: str, html: str) -> bool:
    """Send a transactional email. Returns True on success, False on any failure."""
    try:
        result = await asyncio.to_thread(_send_sync, to, subject, html)
        if result:
            logger.info("[email] sent '%s' to %s", subject, to)
        else:
            logger.warning("[email] send returned no ID for '%s' to %s", subject, to)
        return result
    except Exception as exc:
        logger.error("[email] failed '%s' to %s: %s", subject, to, exc)
        return False


# -- Base layout ---------------------------------------------------------------

def _wrap(body_html: str) -> str:
    """Wrap a body block in the shared Flourish email shell."""
    return (
        "<!DOCTYPE html>"
        '<html lang="en">'
        "<head>"
        '<meta charset="UTF-8" />'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'
        "<title>Flourish</title>"
        "</head>"
        '<body style="margin:0;padding:0;background:' + BG + ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">'
        '<table width="100%" cellpadding="0" cellspacing="0" style="background:' + BG + ';padding:40px 16px;">'
        "<tr><td align=\"center\">"
        '<table width="100%" style="max-width:560px;background:' + WHITE + ';border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(83,74,183,0.08);">'

        # Header
        "<tr>"
        '<td style="background:linear-gradient(135deg,' + PURPLE + ',' + PURPLE_DARK + ');padding:32px 40px;text-align:center;">'
        '<p style="margin:0;font-size:26px;font-weight:800;color:' + WHITE + ';letter-spacing:-0.5px;">Flourish</p>'
        '<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);font-weight:500;letter-spacing:0.5px;">FOOD INTELLIGENCE FOR YOUR BODY</p>'
        "</td></tr>"

        # Body
        "<tr>"
        '<td style="padding:36px 40px 28px;">'
        + body_html +
        "</td></tr>"

        # Footer
        "<tr>"
        '<td style="padding:20px 40px 32px;border-top:1px solid #EEEDF8;">'
        '<p style="margin:0;font-size:12px;color:' + TEXT_MUTED + ';text-align:center;line-height:1.6;">'
        "You're receiving this because you have a Flourish account.<br/>"
        '<a href="' + FRONTEND_URL + '" style="color:' + PURPLE + ';text-decoration:none;">Open Flourish</a>'
        "&nbsp;&middot;&nbsp;"
        '<a href="' + FRONTEND_URL + '" style="color:' + TEXT_MUTED + ';text-decoration:none;">Unsubscribe</a>'
        "</p></td></tr>"

        "</table>"
        "</td></tr>"
        "</table>"
        "</body></html>"
    )


def _btn(text: str, url: str, colour: str = PURPLE) -> str:
    return (
        '<a href="' + url + '" style="display:inline-block;background:' + colour
        + ';color:' + WHITE + ';text-decoration:none;font-weight:700;font-size:15px;'
        'padding:14px 28px;border-radius:10px;margin-top:24px;">' + text + "</a>"
    )


def _h1(text: str) -> str:
    return (
        '<h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:' + TEXT
        + ';letter-spacing:-0.4px;line-height:1.3;">' + text + "</h1>"
    )


def _p(text: str, muted: bool = False) -> str:
    colour = TEXT_MUTED if muted else TEXT
    return (
        '<p style="margin:0 0 14px;font-size:15px;color:' + colour
        + ';line-height:1.65;">' + text + "</p>"
    )


def _divider() -> str:
    return '<hr style="border:none;border-top:1px solid #EEEDF8;margin:24px 0;" />'


def _highlight_box(html: str) -> str:
    return (
        '<div style="background:' + BG + ';border-left:4px solid ' + PURPLE
        + ';border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">'
        + html + "</div>"
    )


def _check_list(*items: str) -> str:
    """Render a list of items with a tick-style bullet using HTML entities."""
    rows = "".join(
        '<p style="margin:0 0 6px;font-size:14px;color:' + TEXT + ';line-height:1.6;">'
        "&#10003;&nbsp;&nbsp;" + item + "</p>"
        for item in items
    )
    return rows


def _lock_list(*items: str) -> str:
    """Render a list of unlocked features with an open-lock HTML entity."""
    rows = "".join(
        '<p style="margin:0 0 6px;font-size:14px;color:' + TEXT + ';line-height:1.6;">'
        "&#128275;&nbsp;&nbsp;" + item + "</p>"
        for item in items
    )
    return rows


# -- 1. Welcome email ----------------------------------------------------------

async def send_welcome_email(to: str, name: str) -> bool:
    first = name.split()[0] if name else "there"
    body = (
        _h1("Welcome to Flourish, " + first)
        + _p("You've just taken the first step towards understanding exactly how food is affecting your body.")
        + _p("Flourish rates every food you scan across four dimensions personalised to your specific health conditions -- so you never have to guess again.")
        + _highlight_box(
            '<p style="margin:0 0 10px;font-size:13px;font-weight:700;color:' + PURPLE + ';text-transform:uppercase;letter-spacing:0.8px;">What you can do right now</p>'
            + _check_list(
                "Scan any food and get your personalised score",
                "See how it scores on naturalness",
                "Get your 3 free scans per day",
            )
        )
        + _p("Upgrade to Premium and unlock your full hormonal impact score, inflammation rating, gut health score, food diary, and unlimited scans.", muted=True)
        + _btn("Start Scanning", FRONTEND_URL)
    )
    return await send_email(to, "Welcome to Flourish", _wrap(body))


# -- 2. Subscription confirmed -------------------------------------------------

async def send_subscription_confirmed_email(to: str, name: str, plan: str) -> bool:
    first = name.split()[0] if name else "there"
    plan_label = "Annual (&#163;49.99/year)" if plan == "annual" else "Monthly (&#163;12.99/month)"
    body = (
        _h1("You're now a Flourish Premium member")
        + _p("Hi " + first + ", your subscription is confirmed and all premium features are unlocked.")
        + _highlight_box(
            '<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:' + GREEN + ';text-transform:uppercase;letter-spacing:0.8px;">Your plan</p>'
            + '<p style="margin:0;font-size:15px;font-weight:700;color:' + TEXT + ';">' + plan_label + "</p>"
        )
        + _p("Here's everything that's now unlocked for you:")
        + (
            '<ul style="margin:0 0 20px;padding-left:20px;font-size:15px;color:' + TEXT + ';line-height:1.9;">'
            "<li>Unlimited food scans, every day</li>"
            "<li>Hormonal impact score for every food</li>"
            "<li>Inflammation and gut health ratings</li>"
            "<li>Full food diary with history</li>"
            "<li>Daily symptom tracking</li>"
            "<li>Personalised meal planner</li>"
            "<li>Insights, streaks, and weekly reports</li>"
            "<li>Unlimited favourites and shopping list</li>"
            "</ul>"
        )
        + _p("If you ever need to manage or cancel your subscription, you can do it in one tap from the Profile tab.", muted=True)
        + _btn("Open Flourish", FRONTEND_URL, GREEN)
    )
    return await send_email(to, "Your Flourish Premium subscription is confirmed", _wrap(body))


# -- 3. Trial ending reminder --------------------------------------------------

async def send_trial_ending_email(to: str, name: str) -> bool:
    first = name.split()[0] if name else "there"
    body = (
        _h1("Your free trial ends tomorrow")
        + _p("Hi " + first + ", just a quick heads-up -- your 3-day Flourish Premium trial ends in 24 hours.")
        + _p("After that, you'll move to the free plan and lose access to:")
        + (
            '<ul style="margin:0 0 20px;padding-left:20px;font-size:15px;color:' + TEXT_MUTED + ';line-height:1.9;">'
            "<li>Your hormonal impact scores</li>"
            "<li>Inflammation and gut health ratings</li>"
            "<li>Your food diary and history</li>"
            "<li>Symptom tracking and insights</li>"
            "<li>Unlimited scans</li>"
            "</ul>"
        )
        + _highlight_box(
            '<p style="margin:0;font-size:14px;color:' + TEXT + ';line-height:1.6;">'
            "<strong>No action needed if you want to keep Premium.</strong> "
            "Your subscription will continue automatically and you won't be charged until after the trial ends."
            "</p>"
        )
        + _p("Want to cancel? You can do it in one tap from the Profile tab before your trial ends -- no questions asked.", muted=True)
        + _btn("Manage My Subscription", FRONTEND_URL + "/#profile")
    )
    return await send_email(to, "Your Flourish trial ends tomorrow -- here's what you'll lose", _wrap(body))


# -- 4. Scan limit reached -----------------------------------------------------

async def send_scan_limit_email(to: str, name: str) -> bool:
    first = name.split()[0] if name else "there"
    body = (
        _h1("You've used all your free scans for today")
        + _p("Hi " + first + ", you've hit your 3 free scans for today. Come back tomorrow for 3 more -- or upgrade to Premium for unlimited scans every day.")
        + _highlight_box(
            '<p style="margin:0 0 10px;font-size:13px;font-weight:700;color:' + PURPLE + ';text-transform:uppercase;letter-spacing:0.8px;">With Flourish Premium</p>'
            + _lock_list(
                "Unlimited food scans, every day",
                "Hormonal impact score for every food",
                "Food diary, symptom tracking &amp; insights",
                "Personalised meal planner",
            )
        )
        + _p("Start your <strong>3-day free trial</strong> today -- no charge until day 4, cancel anytime.")
        + _btn("Start Free Trial", FRONTEND_URL)
        + _divider()
        + _p("Less than 43p a day. Less than one coffee a week.", muted=True)
    )
    return await send_email(to, "You've hit your scan limit -- upgrade for unlimited scans", _wrap(body))


# -- 5. Referral reward --------------------------------------------------------

async def send_referral_reward_email(to: str, referrer_name: str, referred_name: str) -> bool:
    first = referrer_name.split()[0] if referrer_name else "there"
    referred_first = referred_name.split()[0] if referred_name else "someone you referred"
    body = (
        _h1("Your referral just subscribed")
        + _p("Great news, " + first + " -- " + referred_first + " just subscribed to Flourish Premium using your referral link.")
        + _highlight_box(
            '<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:' + GREEN + ';text-transform:uppercase;letter-spacing:0.8px;">Your reward</p>'
            + '<p style="margin:0;font-size:15px;font-weight:700;color:' + TEXT + ';">One free month of Flourish Premium</p>'
            + '<p style="margin:6px 0 0;font-size:13px;color:' + TEXT_MUTED + ';">Applied automatically to your account.</p>'
        )
        + _p("Keep sharing your referral link -- every person who subscribes earns you another free month.")
        + _p("You can find your referral link and track your earnings in the Profile tab.", muted=True)
        + _btn("View My Referrals", FRONTEND_URL + "/#profile")
    )
    subject = referred_first + " subscribed -- you've earned a free month of Flourish Premium"
    return await send_email(to, subject, _wrap(body))


# -- 6. Password reset ---------------------------------------------------------

async def send_password_reset_email(to: str, name: str, reset_link: str) -> bool:
    first = name.split()[0] if name else "there"
    body = (
        _h1("Reset your Flourish password")
        + _p("Hi " + first + ", we received a request to reset your password.")
        + _p("Click the button below to choose a new password. This link expires in 2 hours.")
        + _btn("Reset My Password", reset_link)
        + _divider()
        + _p("If you didn't request a password reset, you can safely ignore this email. Your password won't change.", muted=True)
    )
    return await send_email(to, "Reset your Flourish password", _wrap(body))


# -- 7. Weekly report ----------------------------------------------------------

async def send_weekly_report_email(
    to: str,
    name: str,
    scan_count: int,
    avg_score: int,
    green_foods: list,
    red_foods: list,
) -> bool:
    first = name.split()[0] if name else "there"
    score_colour = GREEN if avg_score >= 70 else ("#BA7517" if avg_score >= 40 else "#A32D2D")

    green_list = (
        "".join(
            '<li style="color:' + GREEN + ';font-weight:600;">' + f + "</li>"
            for f in green_foods
        )
        if green_foods
        else '<li style="color:' + TEXT_MUTED + ';">Keep logging to see your top foods</li>'
    )
    red_list = (
        "".join(
            '<li style="color:#A32D2D;">' + f + "</li>"
            for f in red_foods
        )
        if red_foods
        else '<li style="color:' + GREEN + ';font-weight:600;">None this week -- great work!</li>'
    )

    body = (
        _h1("Your Flourish weekly report, " + first)
        + _p("Here's how your food choices looked this week.")

        # Score cards
        + (
            '<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">'
            "<tr>"
            '<td width="48%" style="background:' + BG + ';border-radius:12px;padding:20px;text-align:center;">'
            '<p style="margin:0 0 4px;font-size:12px;font-weight:700;color:' + TEXT_MUTED + ';text-transform:uppercase;letter-spacing:0.8px;">Foods scanned</p>'
            '<p style="margin:0;font-size:36px;font-weight:800;color:' + PURPLE + ';">' + str(scan_count) + "</p>"
            "</td>"
            '<td width="4%"></td>'
            '<td width="48%" style="background:' + BG + ';border-radius:12px;padding:20px;text-align:center;">'
            '<p style="margin:0 0 4px;font-size:12px;font-weight:700;color:' + TEXT_MUTED + ';text-transform:uppercase;letter-spacing:0.8px;">Avg score</p>'
            '<p style="margin:0;font-size:36px;font-weight:800;color:' + score_colour + ';">' + str(avg_score) + "</p>"
            "</td>"
            "</tr></table>"
        )

        # Food columns
        + (
            '<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">'
            '<tr valign="top">'
            '<td width="48%" style="background:#f0f7e6;border-radius:12px;padding:16px 20px;">'
            '<p style="margin:0 0 10px;font-size:12px;font-weight:700;color:' + GREEN + ';text-transform:uppercase;letter-spacing:0.8px;">Best foods</p>'
            '<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.8;">' + green_list + "</ul>"
            "</td>"
            '<td width="4%"></td>'
            '<td width="48%" style="background:#fdf0f0;border-radius:12px;padding:16px 20px;">'
            '<p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#A32D2D;text-transform:uppercase;letter-spacing:0.8px;">Foods to watch</p>'
            '<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.8;">' + red_list + "</ul>"
            "</td>"
            "</tr></table>"
        )

        + _p("Keep logging every day to build a clearer picture of how food affects your health.", muted=True)
        + _btn("Open Flourish", FRONTEND_URL)
    )
    return await send_email(to, "Your Flourish weekly food report", _wrap(body))


# -- 8. Cancellation -----------------------------------------------------------

async def send_cancellation_email(to: str, name: str) -> bool:
    first = name.split()[0] if name else "there"
    body = (
        _h1("Your Flourish Premium subscription has been cancelled")
        + _p("Hi " + first + ", we're sorry to see you go. Your subscription has been cancelled and your account has returned to the free plan.")
        + _highlight_box(
            '<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:' + TEXT_MUTED + ';text-transform:uppercase;letter-spacing:0.8px;">Good news</p>'
            + '<p style="margin:0;font-size:15px;color:' + TEXT + ';line-height:1.6;">'
            "All your scan history, saved foods, and diary entries are still here whenever you come back."
            "</p>"
        )
        + _p("If you cancelled by mistake or want to restart your journey, you can resubscribe at any time -- your data will be exactly where you left it.", muted=True)
        + _btn("Resubscribe", "https://theflourishapp.health")
    )
    return await send_email(to, "Your Flourish Premium subscription has been cancelled", _wrap(body))
